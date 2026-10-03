# Quest engine: целевая доменная модель

> **Статус:** план. Имена сущностей описывают целевую семантику, а не готовые
> классы или таблицы. Private implementation проектируется внутри capabilities.

## Главная граница

Quest engine является интерпретатором опубликованного определения квеста.

```text
immutable QuestDefinitionRevision
              +
persistent HeroQuestRun
              +
deduplicated DomainEvent
              ↓
     state transition + typed effects
              ↓
board / dialog / journal / targets / counters / world projections
```

Authored definition, player run и wire projection — три разные модели. Wire
поля не становятся автоматически доменными полями, а UI-граф редактора не
становится runtime state.

Quest является не единственным владельцем интерактивного сценария. NPC,
предмет или объект открывает общий `InteractionBoard`, а его entry может вести
в quest run, standalone dialog, activity или service invocation. Эти владельцы
переиспользуют presentation/effect primitives, но не притворяются квестами.

## Агрегаты и идентичность

### QuestDefinition

Стабильная authored identity квеста (`questKey`). Содержит только ссылку на
активную immutable revision и lifecycle публикации: draft/active/archived.

Архивация запрещает новые runs, но не удаляет revisions, history и уже
завершённые записи героя.

### QuestDefinitionRevision

Immutable snapshot всей исполняемой семантики:

- metadata и presentation;
- availability conditions;
- entry points/boards;
- objective graph;
- dialog graph;
- typed effects и rewards;
- repeat policy;
- party policy;
- cancellation policy;
- compatibility digest.

Revision создаётся только успешной content publication. Runtime никогда не
смешивает строки разных revisions.

### HeroQuestRun

Одна попытка героя пройти одну revision. Минимальная identity:
`runId`, `heroId`, `questKey`, `revisionId`, `cycleKey`.

Run содержит:

- lifecycle status;
- активные graph nodes;
- ссылки на dialog sessions по сценам, но не один глобальный cursor;
- objective instances и progress;
- branch decisions;
- waiting state;
- персональные quest facts/world facts;
- timestamps;
- cancellation/finish reason;
- applied event ids и effect operation ids через специализированные stores.

Нельзя выводить всю identity run только из `(heroId, questKey)`: повторяемый
квест имеет несколько исторических attempts/cycles.

### DialogSession и DialogueDecision

`DialogSession` — отдельный checkpoint прохождения конкретной scene. Он
идентифицируется hero, revision, scene/entry и activation token; после принятия
связывается с `runId`. До принятия допустима lightweight offer session, которая
не является run и не появляется в journal/history.

`DialogueDecision` — append-only результат choice/check: входные данные и
вероятность на момент попытки, outcome, выбранное edge и idempotency command.
Decision создаётся в одной транзакции с effects и новым checkpoint. Поэтому
reopen/reconnect не перебрасывает красноречие и не повторяет выдачу предмета.

Разговоры у нескольких NPC и разные objective activations имеют разные sessions. Полная модель,
resume policies и presentation описаны в
[DIALOG_SEMANTICS.md](DIALOG_SEMANTICS.md).

### InteractionHost, ActivityProgress и ServiceInvocation

`InteractionHost` идентифицирует NPC, item instance/kind, AREA или world object,
который открыл board. Отображаемый `Presenter` хранится отдельно и может
меняться между узлами сцены.

`InteractionEpisode` сохраняет выбранный разговор item-hosted/rotating dialog,
чтобы close/reconnect не перебрасывал selector. `ActivityProgress` хранит
долгую последовательность испытаний и unlocked tier независимо от quest
history. `RewardClaimTrack` хранит отдельный cooldown периодической награды.
`ServiceInvocation` snapshot-ит цену, длительность, destination и wait
presentation поездки или другой длительной услуги.

Полный контракт и пример «Сфер мага» находятся в
[INTERACTION_HUBS_AND_SERVICES.md](INTERACTION_HUBS_AND_SERVICES.md).

### HeroQuestDecision и QuestOutcome

Decision — выбранный `optionId` внутри run. Он управляет достижимостью graph и
сам по себе не обязан менять постоянный мир. Нельзя использовать permanent
world flag вместо decision: отмена, незавершённая ветка и повтор command тогда
становятся неоднозначны.

QuestOutcome — именованный атомарный пакет долгоживущих последствий. Он может
содержать:

- permanent personal facts;
- actor disposition: visible/hidden/replaced;
- succession/role assignment, например новый атаман;
- downstream quest/dialog availability;
- capability/reputation unlock;
- ending id для history;
- связанные terminal assets/rewards.

Outcome имеет явную commit policy: `on_decision`, `on_milestone` или
`on_completion`. Временный preview до commit принадлежит run и очищается
cancel policy; уже committed permanent outcome отменой не откатывается.
Несколько фактов одного outcome публикуются одной операцией: нельзя получить
мир, где прежний NPC мёртв, а его преемник ещё не занял роль.

Три уровня состояния не смешиваются:

- run fact — локальная память текущей попытки;
- reported claim/knowledge — что герой узнал или кому что сказал;
- permanent personal world fact — что действительно произошло в мире героя.

Например, реплика «командор мёртв» врагу является reported claim, а не фактом
смерти командора.

### HeroQuestHistory

Неизменяемая краткая запись результата попытки. История сохраняется после
архивации определения и после очистки operational details.

Минимум:

- `heroId`, `questKey`, `revisionId`, `runId`;
- `startedAt`, `finishedAt`/`cancelledAt`;
- outcome;
- cycle key;
- выбранный ending/reward id;
- title snapshot для отображения истории после переименования/архивации.

История не используется вместо active state и не переписывается новой
revision.

### QuestAssetGrant

Ledger ресурсов, принадлежащих конкретному run:

- выданный item instance или количество stackable item;
- временный effect/permission;
- quest fact/world override;
- источник effect operation id;
- cleanup policy.

Он необходим, чтобы отмена забирала именно выданные этим run quest-assets, а
не все предметы того же artikul, включая ранее принадлежавшие герою. Награда,
которая стала обычной собственностью после завершения, помечается permanent и
не очищается отменой.

Временные grants дополнительно имеют generation token и expiry policy.
Progress может принадлежать run, node activation, конкретной generation,
repeat iteration или interaction window. Полный контракт находится в
[TEMPORARY_ASSETS_AND_EFFECTS.md](TEMPORARY_ASSETS_AND_EFFECTS.md).

## Lifecycle

### Definition lifecycle

```text
draft → candidate_validated → active → archived
                  ↘ invalid
```

Invalid candidate не создаёт revision и не меняет active pointer.

### Run lifecycle

```text
eligible (вычисляемое, строки run ещё нет)
  → active
  → ready_to_turn_in
  → completed

active / ready_to_turn_in
  → cancelled

active
  → failed      (зарезервировано; не включать без QR-01 или product decision)
```

`available`, `unavailable` и `cooldown` преимущественно являются projection
states, а не persistent run statuses.

`ready_to_turn_in` можно хранить или детерминированно вычислять из graph state;
конкретное решение принимает architecture capability после оценки locking и
query cost. Оно не должно расходиться с journal/board.

### Почему нет offered

Открытие доски или диалога без принятия не создаёт persistent run. Offer
получается из active definition, availability и entry point. При этом
pre-accept диалог с несколькими committed шагами, check или effect может создать
`DialogSession`: это не lifecycle state квеста, не запись journal и не history.
Чистый offer без таких действий остаётся stateless. Reservation/timer также
требуют отдельного доказанного session/state, а не фиктивного run.

## Objective graph

Последовательный `goal_ord` недостаточен. Целевая модель использует graph nodes:

| Node        | Семантика                                                        |
| ----------- | ---------------------------------------------------------------- |
| `objective` | одна player-facing цель с составным completion expression        |
| `sequence`  | открывает objective nodes строго по очереди                      |
| `repeat`    | повторяет конечное body заданное число раз с отдельной итерацией |
| `choice`    | фиксирует выбранную ветку                                        |
| `gate`      | ждёт condition без счётчика либо recovery interaction            |
| `reward`    | terminal/turn-in с выбранным reward package                      |
| `end`       | terminal без награды или после неё                               |

Run держит не множество player-facing целей, а один текущий stable stage. У
objective stage completion expression может содержать `all`, `any`, `set` и
`ordered_set` requirements. Поэтому «поговорить с NPC A, B, C в любом порядке»
является одной целью с тремя independently progressing members. Для «принести
X или заплатить Y» одна цель содержит `any` над двумя requirements. Graph нужен
для последовательности, ветвления, bounded repeat, turn-in и terminal outcome;
он не публикует будущие nodes до их активации.

Persisted run хранит один `activeStageId`. Чаще это `objective`, но
ожидающий разговора `gate/choice/turn-in` также является player-facing stage и
обязан дать один journal target без counters (например «Вернитесь к NPC»).
Чисто технические control nodes схлопываются атомарно до следующего стабильного
stage. Поэтому активный run не остаётся без текущей цели и не раскрывает
будущую.

Graph обязан быть конечным и валидируемым. Подтверждённые content-сценарии
`kill → talk → repeat` и `release bait → fight → repeat` выражаются только
отдельным bounded `repeat`: definition задаёт конечное число итераций, body и
reset boundary, а run хранит iteration index/token. Произвольный edge назад и
неограниченный cycle в v1 являются ошибкой публикации.

Это ограничение относится к objective graph. Dialog graph может иметь ответы
«назад» и цикличные меню; validator отдельно доказывает, что повторный обход не
дублирует mutations, checks, costs, fights или rewards.

Iteration token входит в idempotency/progress key. Событие предыдущей итерации
не может закрыть следующую; временный target/corpse/encounter связывается с
конкретной итерацией.

## Dialog graph

Dialog graph отвечает за presentation и выбор игрока, но не дублирует objective
state. Узлы:

- renderable screen: presenter + content + отфильтрованные player answers одним
  клиентским payload;
- skill/probability check;
- принять квест или текущую objective stage;
- invoke typed effects;
- turn-in/reward;
- close/jump presentation;
- end.

Ребро может иметь conditions и transition label, но не произвольный код.
Выбранное branch decision, effects и новый session checkpoint фиксируются одной
транзакцией, чтобы retry одного `npc|answer` не перебросил RNG и не выдал награду
повторно. Entry resolver выбирает сцену по точному objective/run/outcome state;
standalone dialog может использовать тот же graph без `HeroQuestRun`.
пересекающиеся правила обязаны иметь явный priority. Нормативные правила выхода,
resume, check attempts, rich text и marker/icon projection находятся в
[DIALOG_SEMANTICS.md](DIALOG_SEMANTICS.md).

## Journal и tracker projection

Каждый stable active stage проецируется в один `QuestTargetProjection`.
Objective stage добавляет description и counter definitions своих
requirements; gate/choice/turn-in обычно даёт только description. Requirements
не становятся отдельными target rows. Следующий stage не materialize до
перехода; закрытый target остаётся finished history, пока квест активен.

Quest list, targets и counter values являются тремя согласованными projections.
Назначение всех текстов и ограничения клиента описаны в
[TEXT_SURFACES_AND_QUEST_UI.md](TEXT_SURFACES_AND_QUEST_UI.md).

`favorite/chosen`, `trackedQuestId`, `selectedQuestId` и expanded state не
являются состоянием run. В original client favorites и expanded state локальны,
tracked quest — отдельная user preference cardinality `0..1`, selected quest —
только состояние открытой книги.

## Conditions

Condition — чистый запрос к snapshot героя/run/world. Он ничего не изменяет.

Категории:

- identity/progression: level, faction/kind, gender, rank;
- economy/inventory: money, artifact instance/count/type;
- quest: history status, active status, objective/counter, branch decision;
- world: area/copy, personal fact;
- character systems: profession, reputation, achievement, mission;
- social: party membership/size; clan позже;
- time window — только когда появится общий event/calendar contract.
- actor disposition/role и committed quest outcome.

Condition tree поддерживает `all` и `any`. `not` включается только вместе с
понятным editor representation и реальным сценарием; низкоуровневое поле
`inverse` из клиента не копируется автоматически в authoring API.

## Events и progress

`QuestEvent` — quest-specific projection immutable domain fact с уникальным
`eventId`, временем и участниками. Точный envelope и payload catalog находятся
в [EVENT_CONTRACTS_V1.md](EVENT_CONTRACTS_V1.md).
Минимальные семейства:

- NPC interaction;
- inventory granted/removed/used/equipped;
- purchase/trade-like exchange;
- area entered / object interaction completed;
- fight started/participant defeated/fight finished;
- party membership snapshot;
- timer/item expiry;
- explicit dialog choice;
- operator migration/cancellation.

Objective подписывается на event kind и содержит typed matcher. Event adapters
принадлежат модулям-источникам; quest engine не читает их таблицы напрямую.

## Effects

Effect — типизированная команда с declared owner и execution phase:

- `IN_TRANSACTION`: progress, facts, reservations, inventory/money mutation,
  reward ledger;
- `AFTER_COMMIT`: старт RAM fight, chat/presence push;
- `PROJECTION_ONLY`: jump/close/visual response fields.

Effect registry для каждого типа задаёт:

- schema;
- cross-reference validation;
- owning public port;
- idempotency key;
- allowed hooks;
- rollback/cleanup policy;
- response/realtime contribution.

Произвольный JavaScript/PHP/SQL effect запрещён. Для уникальной механики
добавляется новый зарегистрированный effect handler, который затем доступен
любому квесту. Это ответ на вопрос об «escape hatch»: расширение допустимо, но
оно остаётся production code с типами и тестами, а не кодом внутри контента.

## Repeatability

Repeat policy не смешивается с presentation category:

```text
once
cooldown(duration, anchor=finished_at)
immediate
```

Calendar/event recurrence (`day`, `week`, season reset) не кодируется магией
`daily`. Она появится позднее через отдельный Schedule/EventCycle port.

`cycleKey` обеспечивает идемпотентную награду каждой попытки. Finished history
сохраняется для всех cycles; wire может показывать только текущий cooldown и
отдельный finished history view.

## Versioning active runs

Target policy для несовместимого изменения:

1. публикация создаёт новую immutable revision;
2. semantic diff классифицирует изменение;
3. presentation-only изменение может не требовать отмены;
4. несовместимое изменение требует явной policy `cancel_active_runs`;
5. quest временно закрывается для новых accept;
6. старые runs отменяются batches с cleanup assets и history reason
   `definition_replaced`;
7. только после успешного cleanup новая revision становится доступна;
8. частичный rollout не маскируется: операция имеет persisted status и может
   быть безопасно продолжена после restart.

Автоматическое сопоставление старых и новых graph nodes не входит в baseline.
В будущем может появиться explicit migration map, но не heuristic по ord/title.

## Presentation categories

`main`, `default`, `group`, `instance`, `repeatable`, `exchange` и подобные
ярлыки не должны сами определять runtime behavior. Они выбирают flags/icons,
sorting и editor presets. Behavior задают repeat/party/objective/effect
policies. Это предотвращает появление огромного switch по «типу квеста».
