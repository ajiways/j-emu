# Quest engine: составные предметы и преобразования ресурсов

> **Статус:** целевой контракт. Он не объявляет текущий `CraftService`
> универсальным и не фиксирует окончательные TypeScript names.

## Решение

Квестовый движок не реализует собственный inventory craft и не вызывает
профессии напрямую. Он зависит от общего порта атомарных преобразований:

```text
trigger + actor + context + transformation key + operation id
                         ↓
            validate/reserve/consume/grant/facts
                         ↓
              committed TransformationResult
                         ↓
                  quest domain event
```

Профессиональный craft, сборка у NPC, ремонт world object и использование
составного quest item могут использовать один низкоуровневый transaction
primitive. Их публичные правила остаются разными.

## Почему текущего craft недостаточно

Текущий `j-emu` `CraftService` уже поддерживает несколько ингредиентов,
проверку изученного рецепта/профессии/навыка, recipe cooldown и выдачу одного
типа результата. Это хорошее evidence существующей границы профессий, но не
готовый quest primitive:

- quest transform часто не требует изученного рецепта или профессии;
- NPC может выполнить работу вместо героя;
- результатом бывает world fact или бой, а не item;
- нужны quest ownership, recovery и cancellation cleanup;
- нужно различать catalyst/tool/ingredient;
- location/table и interaction presentation являются частью сценария;
- retry должен ссылаться на operation id, а не повторно списывать inputs.

Поэтому QE-00 отдельно решает, можно ли извлечь общий inventory transaction из
`CraftService`, сохранив profession orchestration над ним.

## Transformation definition

Концептуальная форма:

```json
{
  "key": "assemble_signal_device",
  "trigger": {
    "type": "AREA_OBJECT",
    "areaId": 44,
    "objectId": "workbench"
  },
  "guards": [
    { "type": "QUEST_NODE_ACTIVE", "nodeId": "assemble" },
    { "type": "RUN_FACT", "key": "blueprint_read", "equals": true }
  ],
  "inputs": [
    { "artifactId": 101, "count": 2, "mode": "CONSUME", "ownership": "QUEST_RUN" },
    { "artifactId": 102, "count": 1, "mode": "CONSUME", "ownership": "QUEST_RUN" },
    { "artifactId": 103, "count": 1, "mode": "REQUIRE_ONLY", "ownership": "HERO" }
  ],
  "outputs": [
    { "type": "GRANT_QUEST_ASSET", "artifactId": 110, "count": 1 },
    { "type": "SET_RUN_FACT", "key": "device_assembled", "value": true }
  ],
  "onDenied": { "channel": "PLAQUE", "textKey": "quest.device.missing_parts" }
}
```

Это пример семантики, не утверждённая JSON schema.

## Input modes

| Mode           | Семантика                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `CONSUME`      | количество списывается только при успешном commit                                                     |
| `RESERVE`      | instance/count блокируется на время persistent waiting и списывается/возвращается по authored outcome |
| `REQUIRE_ONLY` | предмет/инструмент должен присутствовать, но не расходуется                                           |
| `DAMAGE`       | изменяется durability/charges через inventory port; только после появления общей модели durability    |

Для каждого input задаются допустимые containers и ownership. По умолчанию
quest transform не берёт предмет из банка/почты/торга и не заменяет
`QUEST_RUN`-компонент обычным предметом героя без явного разрешения.

## Output modes

- обычный или quest-bound item;
- run fact;
- personal world fact;
- objective progress event с transformation operation id;
- after-commit encounter intent;
- waiting result/presentation.

Несколько outputs принадлежат одной операции. Если обязательный in-transaction
output нельзя создать (например, нет места для уникального предмета), inputs
не списываются и progress не меняется.

## Transaction и concurrency

Операция выполняется под hero/run и inventory locks:

1. дедупликация `operationId`;
2. повторная проверка trigger/context/active node/guards;
3. разрешение конкретных input instances и attributed stack quantities;
4. проверка capacity для item outputs;
5. reserve/consume и in-transaction outputs;
6. запись immutable result и quest event;
7. commit;
8. after-commit presentation/fight/push.

Запрещены check-then-consume отдельными транзакциями и последовательное
списание A, B, C с возможностью остановиться после B. Одновременные drop/use/
transform запросы дают ровно один terminal result.

Повтор команды с тем же `operationId` возвращает сохранённый result. Команда с
новым id после уже завершённого одноразового quest node отклоняется guard-ом.

## Objective semantics

Нужно различать:

- `COLLECT_BUNDLE`: сейчас владеть всеми входами; progress может уменьшиться;
- `DELIVER_BUNDLE`: атомарно передать набор конкретному receiver;
- `PERFORM_TRANSFORMATION`: подтвердить успешную operation подходящего key,
  trigger и owner run;
- `OWN_OUTPUT`: сейчас владеть результатом.

Для «создайте зелье за столом Асифа» правильной целью является
`PERFORM_TRANSFORMATION`, иначе заранее купленное такое же зелье ошибочно
закроет квест. Если оригинал допускает готовый предмет, author явно выбирает
`OWN_OUTPUT` или альтернативную ветку.

## Persistent waiting

Долгая сборка использует общий `QuestInteractionRun`:

- `consume_on_start` подходит только для необратимого начала;
- `reserve_then_consume_on_complete` безопаснее для отменяемого ожидания;
- `require_on_complete` допустим, если inputs можно свободно перемещать, но
  требует authored поведения при их исчезновении;
- таймер хранит `notBefore`, а не живёт только в RAM;
- complete request повторно проверяет reservation/guards и дедуплицируется.

Текст «NPC некоторое время мастерит» сам по себе не доказывает реальный timer.

## Recovery и отмена

До transform каждый компонент следует своей asset recovery policy. После
commit старые inputs более не требуются; downstream зависит от output asset
или записанного fact.

При cancel:

- незавершённые reservations освобождаются или удаляются по declared policy;
- созданный quest-bound output очищается по ledger;
- обычный инструмент героя не удаляется;
- consumed external resources не возвращаются автоматически — возврат должен
  быть явно объявлен и идемпотентен;
- permanent result, уже законно переданный герою концовкой, не откатывается.

Validator должен обнаруживать ситуацию, когда cancel оставляет промежуточный
quest output без владельца или когда recovery повторно создаёт consumable inputs
и позволяет фармить постоянный output.

## Ошибки и presentation

Denied reason типизирован: missing input, wrong ownership/container, wrong
area/object/NPC, missing profession/skill/effect/equipment, busy reservation,
capacity, expired component, inactive node.

Authoring выбирает безопасный канал и текст: plaque, dialog, chat либо waiting
с отдельным completion text. Текст не управляет логикой. Неверный контекст по
умолчанию ничего не consume и не создаёт progress.

## Граница будущего редактора

Редактор показывает не сырой список effects, а форму «Преобразование»:

- где и кто запускает;
- обязательные/расходуемые/нерасходуемые компоненты;
- кто выполняет работу: герой, NPC или объект;
- длительность и момент списания;
- item/fact/world/fight results;
- сообщения для каждого denied outcome;
- recovery при потере каждого quest component;
- preview итоговой transaction и cancellation cleanup.

Обычный profession recipe можно выбирать из каталога по key. Его копия не
встраивается в квест: revision pin-ит совместимую recipe revision либо
publication отклоняется при несовместимом изменении рецепта.
