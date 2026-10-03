# Quest engine: authoring language

> **Статус:** каталог возможностей и объясняющий пример. Нормативная форма v1
> находится в [AUTHORING_SCHEMA_V1.md](AUTHORING_SCHEMA_V1.md), а registry
> payload — в [REGISTRY_CONTRACTS_V1.md](REGISTRY_CONTRACTS_V1.md).

## Требования к языку

Определение должно быть:

- декларативным и versioned;
- строгим: неизвестные поля и типы отклоняются;
- round-trip safe для будущего редактора;
- независимым от PostgreSQL rows и wire DTO;
- пригодным для статической проверки ссылок и достижимости;
- расширяемым registry types, а не per-quest условиями;
- читаемым человеком без знания внутреннего runtime.

## Верхний уровень

Концептуальная структура:

```text
QuestDefinitionRevision
├── identity/presentation
├── availability
├── entryPoints
├── repeatPolicy
├── partyPolicy
├── cancelPolicy
├── objectiveGraph (включая journal каждого стабильного stage)
├── dialogGraph
├── effects/rewardPackages
└── authoringMetadata
```

`authoringMetadata` содержит редакторские notes/layout только в editor store.
Runtime document не принимает layout, selection, цвет узлов графа или UI
collapsed state. Это не относится к authored semantic styles текста и
presentation presets квеста: они являются частью definition и компилируются в
client wire.

`presentation` не является одной парой title/description. Authoring различает
как минимум `quest.title`, `quest.bookSummary`, `quest.rewardPreview`,
`boardEntry.label`, `screen.body`, `target.description` и `counter.label`.
Host presentation (`boardIntro/emptyBoardText`) принадлежит interaction host и
может иметь condition variants по reputation/history/world facts. Полный
словарь: [TEXT_SURFACES_AND_QUEST_UI.md](TEXT_SURFACES_AND_QUEST_UI.md).

## Пример сложного квеста

Псевдо-JSON ниже показывает желаемую выразительность:

```json
{
  "key": "road_watch",
  "classification": ["main"],
  "presentation": {
    "title": "Дозорные Радвея",
    "bookSummary": "Капитан просит проверить дозорных и очистить дорогу.",
    "rewardPreview": "50 опыта и награда капитана.",
    "levelMin": 3,
    "levelMax": null
  },
  "availability": {
    "all": [
      { "type": "QUEST_HISTORY", "quest": "road_intro", "outcome": "completed" },
      { "type": "LEVEL", "min": 3 }
    ]
  },
  "repeatPolicy": { "type": "once" },
  "partyPolicy": {
    "defaultCredit": "personal",
    "reward": "personal"
  },
  "cancelPolicy": {
    "allowed": true,
    "cleanupQuestAssets": true,
    "cleanupPersonalFacts": ["road_watch_gate"]
  },
  "entryPoints": [{ "id": "captain", "type": "npc_board", "npcId": 1617, "dialog": "intro" }],
  "objectiveGraph": {
    "entry": "meet_watchers",
    "nodes": [
      {
        "id": "meet_watchers",
        "type": "objective",
        "objective": {
          "type": "TALK_SET",
          "members": [
            { "key": "watcher_a", "npcId": 201 },
            { "key": "watcher_b", "npcId": 202 },
            { "key": "watcher_c", "npcId": 203 }
          ],
          "required": "all"
        },
        "journal": {
          "description": "Поговорите с тремя дозорными.",
          "counters": [
            { "member": "watcher_a", "label": "Северный дозорный" },
            { "member": "watcher_b", "label": "Западный дозорный" },
            { "member": "watcher_c", "label": "Южный дозорный" }
          ]
        },
        "next": "road_choice"
      },
      {
        "id": "road_choice",
        "type": "choice",
        "journal": { "description": "Вернитесь к капитану и выберите план." },
        "options": [
          { "id": "hunt", "next": "kill_raiders" },
          { "id": "ritual", "next": "ritual_fight" }
        ]
      },
      {
        "id": "kill_raiders",
        "type": "objective",
        "objective": {
          "type": "KILL",
          "botIds": [32],
          "required": 5,
          "credit": "party_nearby"
        },
        "journal": {
          "description": "Победите пятерых налётчиков.",
          "counters": [{ "value": "objective", "label": "Налётчики" }]
        },
        "next": "turn_in"
      },
      {
        "id": "ritual_fight",
        "type": "objective",
        "objective": { "type": "WIN_QUEST_FIGHT", "encounter": "road_ritual" },
        "journal": { "description": "Победите главаря в ритуальном бою." },
        "onActivate": [{ "type": "START_QUEST_FIGHT", "encounter": "road_ritual" }],
        "next": "turn_in"
      },
      {
        "id": "turn_in",
        "type": "reward",
        "package": "main_reward",
        "journal": { "description": "Вернитесь к капитану за наградой." },
        "next": "done"
      },
      { "id": "done", "type": "end", "outcome": "completed" }
    ]
  },
  "rewardPackages": {
    "main_reward": {
      "exp": 50,
      "moneyMinor": 100,
      "items": [{ "artikulId": 77, "count": 1 }]
    }
  },
  "dialogGraph": {
    "entries": [
      {
        "id": "captain_offer",
        "actor": "npc:1617",
        "when": { "type": "QUEST_AVAILABLE" },
        "scene": "intro",
        "priority": 100
      },
      {
        "id": "captain_choose_route",
        "actor": "npc:1617",
        "when": { "type": "NODE_ACTIVE", "node": "road_choice" },
        "scene": "choose_route",
        "priority": 300
      },
      {
        "id": "captain_active",
        "actor": "npc:1617",
        "when": { "type": "QUEST_ACTIVE" },
        "scene": "active_reminder",
        "priority": 100
      }
    ],
    "scenes": {
      "intro": {
        "resumePolicy": "resume_checkpoint",
        "entry": "greeting",
        "nodes": [
          {
            "id": "greeting",
            "type": "screen",
            "speaker": "npc:1617",
            "content": [
              { "type": "text", "style": "npc", "value": "На дороге снова появились налётчики." },
              { "type": "text", "style": "objective", "value": "Поговори с тремя дозорными." }
            ],
            "answers": [
              { "id": "details", "kind": "normal", "text": "Что случилось?", "next": "details" },
              { "id": "accept", "kind": "accept", "text": "Я помогу.", "next": "accept_quest" },
              { "id": "leave", "kind": "close", "text": "Не сейчас.", "next": "close" }
            ]
          },
          {
            "id": "details",
            "type": "screen",
            "speaker": "npc:1617",
            "content": [
              { "type": "text", "style": "npc", "value": "Возьми сигнальный факел:" },
              { "type": "item_ref", "item": "road_signal_flare", "display": "icon" },
              { "type": "text", "style": "hint", "value": "В журнале он также называется" },
              { "type": "item_ref", "item": "road_signal_flare", "display": "text" }
            ],
            "answers": [{ "id": "back", "kind": "normal", "text": "Понятно.", "next": "greeting" }]
          },
          {
            "id": "accept_quest",
            "type": "accept",
            "objectiveEntry": "meet_watchers",
            "effects": [{ "type": "GRANT_QUEST_ITEM", "item": "road_signal_flare", "count": 1 }],
            "next": "accepted"
          },
          {
            "id": "accepted",
            "type": "screen",
            "speaker": "npc:1617",
            "content": [
              { "type": "text", "style": "success", "value": "Начни с дозорных у трёх ворот." }
            ],
            "answers": [
              { "id": "leave", "kind": "close", "text": "Отправиться в путь.", "next": "close" }
            ]
          },
          { "id": "close", "type": "end", "presentation": "close" }
        ]
      },
      "choose_route": {
        "resumePolicy": "resume_checkpoint",
        "entry": "route_answers",
        "nodes": [
          {
            "id": "route_answers",
            "type": "screen",
            "content": [
              { "type": "text", "style": "npc", "value": "Как поступим с разбойниками?" }
            ],
            "answers": [
              {
                "id": "hunt",
                "kind": "normal",
                "text": "Я выслежу их.",
                "effects": [
                  { "type": "SELECT_OBJECTIVE_OPTION", "node": "road_choice", "option": "hunt" }
                ],
                "next": "close"
              },
              {
                "id": "ritual",
                "kind": "fight",
                "text": "Выманим главаря ритуалом.",
                "effects": [
                  { "type": "SELECT_OBJECTIVE_OPTION", "node": "road_choice", "option": "ritual" }
                ],
                "next": "close"
              }
            ]
          },
          { "id": "close", "type": "end", "presentation": "close" }
        ]
      },
      "active_reminder": {
        "resumePolicy": "stateless",
        "entry": "reminder",
        "nodes": [
          {
            "id": "reminder",
            "type": "screen",
            "speaker": "npc:1617",
            "content": [
              { "type": "text", "style": "hint", "value": "Сначала поговори со всеми дозорными." }
            ],
            "answers": [{ "id": "leave", "kind": "close", "text": "Уйти.", "next": "close" }]
          },
          { "id": "close", "type": "end", "presentation": "close" }
        ]
      }
    }
  }
}
```

Имена полей до implementation capability могут измениться. Неизменны
семантические требования: stable node ids, explicit edges, typed objective,
typed effects и отдельные policies.

У run один `activeStageId`. Обычный objective stage содержит completion и
`journal`; устойчивые gate/choice/turn-in stages тоже обязаны иметь `journal`,
например «Вернитесь к капитану». Технические control nodes, не имеющие
player-facing состояния, схлопываются в той же транзакции и никогда не видны
как пустая цель. Future stages существуют только в definition.

Пример намеренно показывает не весь квестовый текст, а разные виды узлов и
контента. Production definition хранит каждую фактическую реплику, ответ,
stage/narration и state-specific entry — dialog нельзя восстановить из одного
objective graph.

## Rich content и inline entities

`content` — общий типизированный список fragments, а не только строка диалога.
Он может применяться в screen content, answer label, target description,
reward preview, board intro/entry label, waiting/plaque и system message. При
этом compiler проверяет capability конкретной client surface и применяет только
явно authored fallback.

Baseline fragments:

```yaml
- { type: text, style: npc, value: "Принеси мне" }
- { type: item_ref, item: wolf_talisman, display: text, count: 3 }
- { type: item_ref, item: wolf_talisman, display: icon, label: "Талисман" }
- { type: money_ref, currency: gold, amount: 10 }
- { type: location_ref, area: northern_gate, display: text_and_navigate }
```

`display:text` и `display:icon` компилируются в `ARTIFACT` и `ARTIFACT_IMG`;
ссылка на именованный runtime item instance — в `ARTIFACT_ITEM`. Для icon всегда
есть локализованный alt/label fallback. Publication проверяет surface capability:
если journal умеет text item, но не большую icon, definition должна иметь
fallback или отклоняется.

Macro hashes, DB instance ids, HTML, raw actions и URL картинок не являются
authored API. Adapter создаёт wire payload из catalog/run snapshot. Полный
registry, surface matrix, navigation semantics и security boundary:
[RICH_CONTENT_AND_MACROS.md](RICH_CONTENT_AND_MACROS.md). Общая presentation
semantics: [DIALOG_SEMANTICS.md](DIALOG_SEMANTICS.md).

## Objective registry

Первая целевая библиотека:

| Objective         | Match                                            | Progress                  |
| ----------------- | ------------------------------------------------ | ------------------------- |
| `TALK`            | NPC interaction + optional board/answer          | set/member                |
| `TALK_SET`        | уникальные NPC/answers из authored member set    | set/member                |
| `KILL`            | defeated participant matches bot/catalog group   | counter                   |
| `COLLECT`         | owned quest-eligible quantity                    | synchronized value        |
| `COLLECT_BUNDLE`  | all/any set of owned item requirements           | synchronized bundle       |
| `ACQUIRE`         | grant/purchase/loot source matches               | counter or owned          |
| `DELIVER`         | NPC interaction + reserved/owned items           | atomic consume + complete |
| `DELIVER_BUNDLE`  | receiver + complete set of attributed inputs     | atomic consume + complete |
| `TRANSFORM`       | committed typed transformation operation         | operation-bound outcome   |
| `BUY`             | completed purchase matches artifact/lot          | counter                   |
| `EQUIP`           | equipped instance matches artifact/slot          | set/counter               |
| `ENTER_AREA`      | committed travel matches area/copy policy        | complete                  |
| `INTERACT_AREA`   | action_finish matches area/object/action         | set/counter/ordered child |
| `WIN_QUEST_FIGHT` | terminal notice matches run-bound encounter      | complete                  |
| `WIN_FIGHTS`      | terminal notice matches fight/bot policy         | counter                   |
| `CHOOSE_DIALOG`   | persisted answer/branch id                       | complete                  |
| `OWN_STATE`       | pure condition becomes true after relevant event | synchronized boolean      |

Новый objective type обязан объявить event subscriptions, matcher, progress
algebra, reset semantics, journal projection и tests.

`COLLECT_BUNDLE` является удобной typed composition, а не новым способом
списывать inventory. Он хранит требования к нескольким разным ресурсам и
синхронизирует readiness. Списание выполняет только `DELIVER_BUNDLE` или
успешная `TRANSFORM` operation. Контракт компонентов, инструментов, recipes и
атомарных outputs описан в [ASSET_TRANSFORMS.md](ASSET_TRANSFORMS.md).

### Progress algebra

Objective выбирает один из явных режимов:

- `counter`: монотонное увеличение до limit;
- `owned`: значение синхронизируется с текущим владением и может уменьшаться;
- `set`: уникальные keys, например NPC A/B/C;
- `boolean`: condition false/true;
- `ordered_set`: уникальные keys в заданной последовательности;
- `bound_outcome`: результат конкретного encounter/run.

Для повторяющегося body progress дополнительно scoped к `iterationToken`.
Например, `kill one → use tool on that corpse` нельзя реализовать двумя
независимыми общими counters: use matcher обязан ссылаться на target/fight token
текущей итерации, а завершение body создаёт следующий token.

Это устраняет старую неоднозначность, когда `loot`, `deliver` и `kill`
смешивали событие получения, текущее количество и готовность к сдаче.

## Condition registry

Conditions используются в четырёх местах:

- доступность квеста;
- видимость entry point/ответа;
- переход graph edge;
- readiness/turn-in guard.

Одинаковое имя condition имеет одну семантику. Нельзя делать отдельные версии
`LEVEL` для магазина, диалога и квеста.

Первый набор: `LEVEL`, `QUEST_HISTORY`, `QUEST_ACTIVE`, `QUEST_OBJECTIVE`,
`FLAG`, `AREA`, `ARTIFACT_COUNT`, `MONEY`, `RANK`, `REPUTATION`,
`PROFESSION`, `PARTY_SIZE`, `QUEST_OUTCOME`, `ACTOR_DISPOSITION`,
`KNOWLEDGE`. Остальные клиентские виды добавляются по evidence. Generic `FLAG`
не заменяет типизированные outcome/knowledge/role, когда их различие влияет на
cleanup, validation или world projection.

## Effect registry

Baseline categories:

- run: activate/complete/reset node, select branch, complete/cancel run;
- assets: grant/consume quest item, promote asset to permanent;
- transformations: атомарно reserve/consume несколько inputs и создать typed
  item/fact/world outputs через public port;
- rewards: grant package exactly once;
- character: money/exp/reputation/profession через public ports;
- world: set/clear personal fact, open personal interaction;
- outcomes: commit named personal outcome bundle, actor disposition и
  succession одной effect operation;
- combat: start typed quest encounter after commit;
- navigation: open store, close/jump dialog, request travel;
- interactions: open board, start standalone episode/activity/service;
- communication: system message after commit;
- composition: start another quest только после отдельной capability.

Каждый hook перечисляет разрешённые effects. Например, `after_commit`
`START_QUEST_FIGHT` нельзя ставить в cancellation cleanup, а permanent reward
нельзя выдавать из обычного dialog reopen.

### Профессия как результат сдачи квеста

Профессия — first-class character capability, а не `SET_FLAG`. В первичном
flow она выдаётся terminal reward при `turn_in`, а не промежуточной репликой:

```yaml
- type: GRANT_PROFESSIONS
  professions: [prospector, signmaker]
  slotPolicy: require_free_primary_slots
```

Для оригинального «Освоения мирных профессий» одного списка недостаточно:
игрок выбирает одну из взаимоувязанных пар, подтверждает выбор, а terminal
bundle также выдаёт добывающего гремлина и первый рецепт. Это моделируется
branch reward/outcome package:

```yaml
professionPaths:
  prospector_signmaker:
    effects:
      - { type: GRANT_PROFESSIONS, professions: [prospector, signmaker] }
      - { type: GRANT_ASSISTANT, assistant: starter_miner_gremlin }
      - { type: GRANT_RECIPE_ITEM, recipe: crystal_solution, deliveryPolicy: inventory_overflow }
```

Весь пакет фиксируется exactly once вместе с выбранной веткой. Повтор ответа не
выдаёт второго помощника/рецепт. Profession domain возвращает dirty projection
для `user|professions` и связанных данных помощника после commit.

Profession catalog объявляет category и slot: основных лицензий одновременно
не более одной `primary_gathering` и одной `primary_manufacturing`; любую
допустимую пару можно сочетать. Fishing/cooking и другие additional categories
не занимают эти slots. Первый рецепт выдаётся предметом. Обычные quest rewards
имеют `inventory_overflow`, поэтому полный рюкзак не отменяет turn-in.

Замена основной профессии позднее будет отдельным quest flow с явным сбросом
старой лицензии и выдачей новой. В baseline `GRANT_PROFESSIONS` ничего не
заменяет. Точный lifecycle стартового помощника при будущей замене остаётся
неизвестным.

### Decision и outcome bundle

Choice option может ссылаться на `outcomePreview` и `commitOutcome`, но не
содержит произвольный набор несвязанных `SET_FLAG`:

```text
option exile_grogo
  → select branch exile
  → commit outcome grogo_exiled (policy=on_decision)

outcome grogo_exiled
  → fact grogo=exiled
  → actor Grogo hidden
  → hotspot grogo_hut uses empty variant
  → history ending exile
```

Outcome является catalog entity со stable id. Cross-content dependency index
находит все entry points, dialogs, quests и world variants, которые его
читают. Переименование или удаление outcome без миграции отклоняется.

Одна option не обязана сразу commit permanent outcome. При policy
`on_milestone` она создаёт run-owned preview, а milestone атомарно promotes
его. Необратимость всегда видна в definition и будущем редакторе.

## Quest assets и delivery

Grant item имеет обязательную ownership policy:

- `quest_bound`: instance/count зарегистрирован за run и очищается при cancel;
- `temporary_until_node`: очищается при завершении узла;
- `consumed_on_deliver`: резервируется и снимается атомарно при сдаче;
- `permanent_reward`: не очищается после успешной выдачи.

Если предмет имеет lifetime, expiry публикует событие. `owned` objective
уменьшается; сценарий может открыть recovery branch. Полный failed outcome не
вводится только ради исчезнувшего предмета.

Expiry обязан дополнительно определить progress scope и реакцию: сохранить
progress, сбросить только scope конкретной generation, выбрать fallback,
переоткрыть acquisition либо отменить run. Правила timer/reissue описаны в
[TEMPORARY_ASSETS_AND_EFFECTS.md](TEMPORARY_ASSETS_AND_EFFECTS.md).

### Зависимость от предмета и результат использования

Следующий шаг обязан различать три разных требования:

1. `requires_asset` — у героя прямо сейчас должен быть конкретный item instance
   или нужное количество;
2. `consumes_asset` — interaction атомарно изымает asset и только затем
   считается успешным;
3. `requires_fact` — сам item больше не нужен, потому что его успешное
   использование уже записало persistent run fact.

Например, цепочка «получить печать → использовать в святилище → нажать три
руны по порядку → начать бой» моделируется так:

```text
grant seal (quest asset)
  → USE_AT_AREA(requires+consumes seal)
  → set run fact ritual_prepared
  → ordered_set(rune_a, rune_b, rune_c, requires ritual_prepared)
  → START_QUEST_FIGHT after commit
```

После успешного использования потеря предмета уже не имеет значения: дальнейшие
шаги зависят от `ritual_prepared`, а не от несуществующего item. Если игрок
выбросил печать раньше, `USE_AT_AREA` не проходит и применяется recovery policy.

### Recovery policy

Каждый quest-owned asset, необходимый незавершённому пути, объявляет поведение
при `drop/sell/trade/use_elsewhere/expire/admin_remove`:

- `deny_removal` — операция запрещена на inventory boundary;
- `reissue_at(entryPoint)` — NPC/объект предлагает replacement, если у run нет
  живого asset;
- `reopen(nodeId)` — снова активируется authored этап получения;
- `reset(groupId)` — сбрасывается выбранная часть graph и её temporary effects;
- `branch(optionId)` — открывается альтернативный recovery path;
- `cancel_run` — полный reset по cancel policy;
- `no_action` — допустимо только если item больше не нужен активному пути.

Policy обязательна, если validator видит путь от grant к незавершённому
`requires_asset/consumes_asset`. Неявная повторная выдача, тихий пропуск проверки
или удаление всех предметов того же artikul запрещены.

`reissue` создаёт новый instance/ledger entry, но не выдаёт дубликат, если
старый asset всё ещё существует в любом разрешённом container. Проверка и
выдача выполняются под hero/run lock.

### Использование не в том месте

Quest item use является typed interaction с контекстом `hero/run/itemInstance/
area/copy/target`. Definition перечисляет допустимые contexts. Неверное место
не consume item и возвращает документированный deny/plaque. Если оригинальный
сценарий требует наказание или засаду за неправильное использование, это
явная branch/effect policy, а не общий inventory fallback.

Полный контракт выбора outcome, каналов ответа и persistent waiting описан в
[INTERACTIONS.md](INTERACTIONS.md).

### Составной предмет и происхождение результата

Для цели «собрать A, B и C, затем изготовить D» graph состоит минимум из двух
разных фактов:

```text
COLLECT_BUNDLE(A, B, C; mode=owned)
  → TRANSFORM(key=assemble_d, trigger=item|npc|area|recipe_ui)
  → requires_fact(transform operation committed) или OWN_STATE(D)
```

Если важно выполнить конкретный рецепт/ритуал, заранее купленный D не закрывает
`TRANSFORM`. Если важно только принести D, author использует обычный owned/
deliver objective. Это решение всегда явное.

## Party policy

Policy задаётся default на quest и может быть overridden на objective:

```text
personal
party_same_area
party_same_instance
party_participants
```

Дополнительные filters: alive/online/distance/participated. Baseline для
обычного kill — `party_same_area + alive + online`; точное решение остаётся
QR-09. Каждый eligible hero получает независимый event application к своему
run. Никакого общего mutable progress row на всю party.

Loot/reward policy отдельно:

- `personal`: roll/grant каждому;
- `contributor_only`;
- `shared_drop` — не baseline и требует trade/loot ownership design.

## Dialog authoring

`dialogGraph` состоит из stable-key scenes и entries. Scene объявляет
`resumePolicy`; entry связывает actor с scene и condition snapshot. Ответ
указывает semantic `kind`, а не рисует иконку вместо поведения:

```yaml
dialogGraph:
  entries:
    - key: guard_active
      actor: npc:guard
      when: { objective_state: { key: enter_camp, state: active } }
      scene: guard_gate
      priority: 100
  scenes:
    guard_gate:
      resumePolicy: resume_checkpoint
      entry: warning
      nodes:
        warning:
          type: screen
          presenter:
            actor: npc:guard
            name: { text: "Страж ворот" }
            portrait: { asset: npc/guard }
          content:
            - { style: warning, text: "Тебе сюда нельзя." }
          answers:
            - { key: leave, kind: normal, next: close }
            - { key: persuade, kind: check, next: persuade_check }
        persuade_check:
          type: check
          check: { kind: oratory, attempt: once_per_activation }
          success: admitted
          failure: refused
```

Authoring schema отдельно хранит:

- conditions выбора entry и доступности answer;
- semantic text styles и allowlisted macros;
- marker role/emphasis и answer kind;
- check formula/attempt policy/success/failure;
- typed effects;
- waiting presentation и серверный completion outcome.

`screen.content` и отфильтрованный `screen.answers` всегда проецируются одним
`npc|answer` payload: варианты находятся непосредственно под репликой NPC.
Недоступные answers сервер не отправляет, но `ChooseAnswer` всё равно повторно
проверяет membership и conditions против свежего snapshot.

Scene может принадлежать quest, standalone interaction, activity или service.
Узел вправе переопределить presenter (actor/name/portrait), поэтому разговор
нескольких NPC не требует поддельных quest transitions. Навигационные циклы и
ответы «назад» разрешены, если validator доказывает exactly-once для всех
достижимых effects. `autoClose: map` явно закрывает окно и возвращает карту.

Предметный host и состав board описаны в
[INTERACTION_HUBS_AND_SERVICES.md](INTERACTION_HUBS_AND_SERVICES.md).

Свободный HTML, asset path и произвольный script запрещены. Полный контракт:
[DIALOG_SEMANTICS.md](DIALOG_SEMANTICS.md).

## Classification presets

Редактор позднее может предлагать presets:

| Preset      | Заполняет, но не скрывает            |
| ----------- | ------------------------------------ |
| Обычный     | once, personal, DEFAULT presentation |
| Сюжетный    | once, MAIN, no-refuse optional       |
| Повторяемый | cooldown + MULTITIME                 |
| Групповой   | GROUP + party progress policy        |
| Инстансовый | INSTANCE + same-instance credit      |
| Обмен       | deliver/consume + immediate reward   |

Preset не является runtime subclass: после создания автор видит и может
изменить каждую policy явно.
