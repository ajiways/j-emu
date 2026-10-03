# Quest engine: interaction pipelines и waiting

> **Статус:** целевой план. Документ описывает общую механику взаимодействий,
> а не только использование квестового предмета.

## Зачем это отдельное понятие

Один игровой trigger может иметь много допустимых исходов:

- предмет использован в правильной или неправильной локации;
- выбран правильный или неправильный объект;
- нужная цель активна либо уже завершена;
- предмет есть, потерян, просрочен или зарезервирован;
- interaction сразу отвечает, запускает waiting или начинает бой;
- результат показывается плашкой, NPC-диалогом, чатом или их допустимой
  комбинацией.

Это нельзя выразить независимыми boolean-полями. Целевая модель — typed
interaction pipeline:

```text
trigger + context
  → выбрать ровно один outcome case
  → выполнить immediate phase
  → optional persistent waiting
  → выполнить completion/cancel phase
  → пересчитать quest projections
```

## Trigger и context

Первая библиотека triggers:

- `USE_ITEM`;
- `AREA_ACTION`;
- `NPC_ANSWER`;
- `ENTER_AREA`;
- `FIGHT_OUTCOME`;
- `WAITING_FINISH` (внутренний continuation, не authored entry point).

Context типизирован по trigger и может содержать:

- hero/run/revision;
- item instance, artikul и quantity;
- area id, instance copy id, map object id, action id;
- active objective/branch/facts;
- NPC/answer;
- fight/encounter outcome;
- request/correlation id и clock time.

Authoring condition не может читать произвольное поле context по строковому
пути. Каждый condition type объявляет поддерживаемые triggers и typed operands.

## Outcome cases

Interaction содержит именованные cases. Case состоит из:

- `id` — стабильная authored identity;
- `when` — condition tree;
- `immediate` — шаги до ответа;
- optional `waiting`;
- `onComplete`, `onCancel`, `onExpired`;
- `terminalResponse` или допустимый response, который сформирует waiting.

Обязателен explicit fallback case. «Условия не совпали → пустой success»
запрещён.

Порядок массива не должен случайно определять семантику. Validator доказывает,
что cases не пересекаются, либо автор задаёт явный `priority` и получает warning
для перекрывающихся условий. Fallback всегда последний и не имеет `when`.

## Typed pipeline steps

Pipeline использует тот же effect registry, но добавляет interaction steps:

| Step                | Фаза                   | Назначение                                 |
| ------------------- | ---------------------- | ------------------------------------------ |
| `ASSERT`            | transaction            | повторная серверная проверка condition     |
| `RESERVE_ASSET`     | transaction            | запретить параллельный drop/use            |
| `CONSUME_ASSET`     | transaction            | изъять конкретный quest asset              |
| `START_WAITING`     | transaction + response | создать waiting instance и показать таймер |
| `SET_RUN_FACT`      | transaction            | сохранить результат использования          |
| `ADVANCE_NODE`      | transaction            | применить graph transition                 |
| `PLAQUE`            | response               | `msg_text`/документированный error channel |
| `NPC_DIALOG`        | response               | `npc                                       | answer`, когда trigger это допускает |
| `CHAT`              | after commit           | system chat packet                         |
| `START_QUEST_FIGHT` | after commit           | idempotent RAM fight intent                |
| `JUMP/CLOSE`        | response projection    | клиентская навигация                       |

Registry определяет совместимость. Например, один OA не может одновременно
вернуть две взаимоисключающие terminal response формы. `CHAT` можно совместить
с waiting/plaque, потому что он идёт after commit отдельным каналом.

## Presentation channels

Автор выбирает канал осознанно:

- `plaque` — короткий непосредственный результат;
- `system_chat` — запись в чат, не замена ошибке OA;
- `npc_dialog` — сцена и ответы;
- `waiting` — progress/timer UI, после которого клиент вызывает finish;
- `fight` — `fight|conf` после commit, возможно piggyback на finish;
- `silent` — только для явно разрешённого технического перехода.

Текст имеет отдельные поля по моменту:

- waiting `title` — подпись полосы;
- waiting `durationSec` — server-authoritative `notBefore`, а не доверие
  клиентскому таймеру;
- optional `picture`/`video` — только после проверки соответствующих
  `waiting_picture`/`waiting_video` полей клиента;
- optional `startPlaque`/`startChat`;
- completion `plaque`;
- completion `chat`;
- cancel/expired presentation.

Нельзя одним полем `text` обслуживать все каналы: Flash интерпретирует
`msg_text`, chat packet и `npc|answer.point.message` по-разному.

## Persistent waiting instance

Этот раздел относится к подтверждённому server flow
`common|waiting → common|action_finish`. Он намеренно не моделирует
`answer_list.waiting_time`: в AS3 это локальная задержка до отправки
`npc|answer`, отменяемая без server request. Для неё допустима отдельная
`answerDelayPresentation`, не создающая runtime state. Полный разбор находится
в [CLIENT_WIRE_CONTRACT_V1.md](CLIENT_WIRE_CONTRACT_V1.md).

Waiting — состояние, а не `sleep` и не RAM timer. `QuestInteractionRun`
содержит:

- `interactionRunId`;
- hero/quest run/revision/case;
- trigger snapshot и selected case;
- `startedAt`, `notBefore`, optional `expiresAt`;
- asset reservation/consume state;
- status `waiting|completed|cancelled|expired`;
- completion operation id;
- authored presentation snapshot, необходимый для текущего response.

Для героя допускается только число одновременных waiting, подтверждённое
клиентским протоколом. Пока evidence показывает один active client waiting,
вводится unique active waiting per hero; расширение требует отдельного wire
исследования.

`action_finish`:

1. находит единственный active waiting;
2. проверяет hero/run/revision/case и `now >= notBefore`;
3. повторно проверяет declared completion guards;
4. выполняет consume-on-complete и transaction effects;
5. помечает waiting completed;
6. сохраняет after-commit intents;
7. возвращает completion presentation/book/state;
8. после commit исполняет chat/fight/presence.

Нет waiting, слишком рано, неверный hero или повторный finish — явный deny либо
идемпотентный replay документированного результата, а не новый transition.

## Asset timing

Interaction явно выбирает один режим:

- `keep` — предмет только проверяется;
- `reserve_until_complete` — с начала waiting нельзя drop/sell/use;
- `consume_on_start` — предмет исчезает до waiting, дальнейший путь держится на
  persisted interaction/run fact;
- `consume_on_complete` — предмет резервируется на start и изымается при
  успешном finish;
- `consume_quantity_on_complete` — для stack attribution.

Если waiting отменён/просрочен:

- reservation освобождается;
- consumed-on-start item возвращается только при explicit compensation policy;
- progress/facts очищаются только declared cleanup steps;
- authored cancel/expired branch может открыть recovery.

Implicit возврат предмета запрещён: после внешних эффектов он может создать
дубликат.

## Пример: предмет использован не там

Псевдо-definition:

```json
{
  "id": "use_ritual_seal",
  "trigger": "USE_ITEM",
  "item": { "questAsset": "ritual_seal" },
  "cases": [
    {
      "id": "wrong_area",
      "priority": 100,
      "when": { "type": "AREA_NOT_IN", "areaIds": [503] },
      "immediate": [
        { "type": "PLAQUE", "text": "Печать здесь не действует." },
        { "type": "CHAT", "text": "От печати исходит слабое тепло." }
      ]
    },
    {
      "id": "correct_altar",
      "priority": 200,
      "when": {
        "all": [
          { "type": "AREA_IS", "areaId": 503 },
          { "type": "MAP_OBJECT_IS", "objectId": 7 },
          { "type": "NODE_ACTIVE", "nodeId": "prepare_ritual" }
        ]
      },
      "immediate": [{ "type": "RESERVE_ASSET", "asset": "ritual_seal" }],
      "waiting": {
        "durationSec": 8,
        "title": "Активация печати…",
        "assetTiming": "consume_on_complete"
      },
      "onComplete": [
        { "type": "SET_RUN_FACT", "fact": "ritual_prepared", "value": "1" },
        { "type": "ADVANCE_NODE", "nodeId": "prepare_ritual" },
        { "type": "PLAQUE", "text": "Печать рассыпалась, а земля задрожала." },
        { "type": "CHAT", "text": "Из глубины доносится рёв." },
        { "type": "START_QUEST_FIGHT", "encounter": "ritual_guardians" }
      ],
      "onCancel": [{ "type": "PLAQUE", "text": "Ритуал прерван." }]
    },
    {
      "id": "fallback",
      "immediate": [{ "type": "PLAQUE", "text": "Сейчас печать использовать нельзя." }]
    }
  ]
}
```

Это иллюстрация языка, не финальные имена полей.

## Несколько точек по порядку

Каждая точка может ссылаться на общий interaction template, но хранит свой
stable step key. `ordered_set` сообщает expected key:

- правильный key → waiting/correct pipeline;
- неправильный key → authored wrong-order case;
- wrong-order case может только показать plaque, сбросить ordered group,
  запустить отдельное waiting, consume другой asset или начать засаду;
- после последнего key group completion исполняет общий onComplete.

Таким образом «неправильная точка тоже запускает такую же полоску, но завершает
её другим текстом» — два cases с одинаковой waiting presentation и разными
completion effects, а не специальная ветка runtime.

## Validation

Candidate отклоняется, если:

- нет fallback;
- case недостижим или неоднозначно перекрывается без priority;
- нет terminal response/waiting для user-triggered outcome;
- waiting duration отрицательный/слишком большой для policy;
- consume не связан с asset ownership;
- consume-on-start не имеет осознанной cancel/expired compensation policy;
- after-commit effect помещён до commit;
- fight start возможен без persisted intent;
- transition/reward можно повторно фармить через waiting replay;
- presentation channel недопустим для trigger/wire response.
