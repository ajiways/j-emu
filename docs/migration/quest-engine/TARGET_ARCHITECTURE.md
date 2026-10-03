# Quest engine: целевая техническая архитектура

> **Статус:** план. Это границы production-компонентов и направление
> зависимостей, а не готовые TypeScript API.

## Архитектурная форма

Quest engine — модульный интерпретатор immutable definitions. Он не владеет
инвентарём, боями, профессиями, картой или wire. Он владеет run state,
decisions, progress, quest-owned assets/facts, receipts и quest projections.

```text
Jugger OA / game command / fight settlement / timer worker
                         │ typed command or QuestEvent
                         ▼
                 QuestApplicationFacade
                         │ one UnitOfWork
       ┌─────────────────┼──────────────────┐
       ▼                 ▼                  ▼
 QuestEventRouter   DialogRuntime      QuestCommandHandler
       └─────────────────┼──────────────────┘
                         ▼
                  TransitionEngine
           definition + run + event → plan
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
        StateWriter  EffectExecutor  OperationQueue
             │       typed ports       external/RAM
             └───────────┼───────────┘
                         ▼ commit
         QuestReadModel / WorldOverlay / WireAdapter
```

Domain/application не импортируют `jugger-wire`, Fastify, AMF или concrete
Postgres repositories. `app` собирает cross-module scenario через public ports.

## Компоненты

### QuestDefinitionCompiler

Работает только при candidate validation/materialization:

- парсит versioned authoring document;
- проверяет graph reachability, cycles и terminal paths;
- разрешает catalog references;
- компилирует condition/effect/requirement registries;
- назначает или проверяет stable wire identities;
- строит host, event-interest, marker и dependency indexes;
- создаёт immutable runtime snapshot и compatibility digest.

Runtime не интерпретирует непроверенный draft и не чинит definition.

### QuestRuntimeCatalog

Читает definition строго по `(releaseId, questKey)`. Active board использует
active release; существующий run использует закреплённую revision до terminal
state или policy-driven cancellation. Catalog cache ключуется release id и
инвалидируется только после успешной activation.

### QuestApplicationFacade

Публичная application-граница модуля:

- queries: board, dialog view, journal, tracker/world overlays;
- commands: accept, answer, turn-in, cancel, select reward, begin/finish
  interaction;
- events: apply one typed game event;
- workers: claim due waits/operations, reconcile encounters;
- publication: inspect active-run impact и выполнить activation policy.

Wire-specific status/error mapping остаётся снаружи.

### QuestEventRouter

Принимает только закрытый registry типов. Минимальный envelope:

```ts
type QuestEvent = Readonly<{
  eventId: string;
  kind: QuestEventKind;
  occurredAt: Date;
  actorHeroId: number;
  participantHeroIds: readonly number[];
  areaId?: string;
  instanceId?: number;
  payload: QuestEventPayload;
}>;
```

`eventId` создаёт владелец операции: command correlation/operation id,
`fightId + terminal kind`, craft operation id и т. п. Payload содержит typed
identity: catalog id, item instance id, provenance, target, outcome. Raw OA form
и произвольный object не проходят в движок.

Нормативные payload, identity и retry semantics определены в
[EVENT_CONTRACTS_V1.md](EVENT_CONTRACTS_V1.md); authoring и handler boundaries —
в [AUTHORING_SCHEMA_V1.md](AUTHORING_SCHEMA_V1.md) и
[REGISTRY_CONTRACTS_V1.md](REGISTRY_CONTRACTS_V1.md).
Compiler, transition algorithm и public facade дополнительно закреплены в
[COMPILER_PIPELINE_V1.md](COMPILER_PIPELINE_V1.md),
[TRANSITION_ENGINE_SPEC_V1.md](TRANSITION_ENGINE_SPEC_V1.md) и
[APPLICATION_API_V1.md](APPLICATION_API_V1.md).

Router:

1. нормализует и сортирует eligible heroes;
2. блокирует hero rows;
3. загружает active runs и pinned definitions;
4. проверяет party credit policy для каждого run;
5. вставляет receipt или пропускает уже применённую пару event/run;
6. вызывает pure transition engine;
7. применяет plans в детерминированном порядке.

Party не получает общий run в baseline. Каждый участник сохраняет персональный
run/progress/reward; shared credit означает применение одного event к нескольким
eligible runs. Loot также выдаётся каждому через owning subsystem.

### TransitionEngine

Чистая детерминированная часть:

```text
CompiledDefinition + RunSnapshot + Input
  → StatePatch + EffectPlan + OperationIntents + DirtyProjectionKeys
```

Она не читает БД, часы, RNG или каталоги. Время, resolved catalog snapshot и
persisted random/check decision передаются входом. Graph closure вычисляется до
fixed point; validator заранее запрещает бесконечные instantaneous cycles.

Новый condition/requirement/effect добавляется как registry member со schema,
validator, evaluator/planner и tests. Проверок `questKey === ...` нет.

### EffectExecutor

Разделяет effects на два класса.

**Transactional DB-effects** выполняются в текущей UoW через public ports:
inventory grant/consume, money, experience, reputation, profession, recipe,
personal fact, location entitlement. Каждый effect имеет `operationKey`; store
получателя или quest receipt гарантирует exactly once.

**External/RAM-effects** сначала записываются в `quest_operations`: start fight,
delayed wake, post-commit notification и будущие внешние интеграции. Dispatcher
claim-ит intent после commit. Ошибка оставляет retryable row, а не частично
успешный transition.

Произвольные JS/request/script payload запрещены. Privileged extension является
отдельным зарегистрированным executor с allowlist.

### DialogRuntime

Standalone и quest scenes используют общий graph evaluator, но разные lifecycle
owners. Runtime хранит session/check/choice checkpoints, поэтому close/reconnect
не повторяет committed effect и не перебрасывает проверку.

Открытие view является read operation. Answer command передаёт session id,
node key, option key и expected revision; stale/replayed answer отклоняется либо
возвращает ранее сохранённый результат по idempotency key.

### QuestEncounterCoordinator

Combat остаётся RAM-hot-state по правилам репозитория. Поэтому quest engine не
считает вызов `startFight()` частью DB-транзакции:

1. transition создаёт persistent encounter + `start_encounter` intent;
2. dispatcher запускает бой с `encounterId` как purpose reference;
3. duplicate dispatch на живом процессе находит тот же encounter;
4. restart видит pending/active encounter без RAM fight и применяет recovery
   policy: recreate, return-to-ready или authored failure edge;
5. terminal event содержит `encounterId`, `fightId`, outcome и participant set;
6. receipt закрывает encounter и продвигает run exactly once.

Обычный hunt kill также приходит как событие по `fightId`, но не притворяется
quest encounter.

Точный start/terminal/restart contract находится в
[ENCOUNTER_COORDINATOR_V1.md](ENCOUNTER_COORDINATOR_V1.md). Combat settlement
пишет durable shared game-fact outbox в своей UoW; in-memory terminal observer
может быть только ускорителем доставки.

### QuestTimerWorker

Waits и expiry хранят absolute `dueAt`, а не process timer как источник истины.
Worker claim-ит due rows через `FOR UPDATE SKIP LOCKED`, создаёт устойчивый
timer event и применяет обычный transition. Reconnect только читает оставшееся
время; restart не теряет timer.

Lease, crash windows, request-time catch-up и отличие operation/fact/wait
зафиксированы в [OPERATIONS_AND_WAITS_V1.md](OPERATIONS_AND_WAITS_V1.md).

### Read models

- `InteractionBoardProjection` — host intro и доступные entries;
- `DialogProjection` — presenter/body/options/awards/wait;
- `QuestJournalProjection` — list/targets/counters/history/cooldowns;
- `QuestWorldOverlay` — related monsters, counter-gated objects, personal facts;
- `QuestAvailabilityProjection` — NPC/map markers новых квестов;
- `QuestWireAdapter` — macros dictionaries и точный legacy OA/AMF shape.

Projection строится из одного committed snapshot. Недоступные entries не
передаются клиенту; command authorization повторяет условия независимо.

## Command transaction

Обычная mutation выполняется так:

1. decode и basic wire validation;
2. начать UoW;
3. заблокировать hero (для party — всех heroes по id);
4. загрузить authoritative actor/world state;
5. заблокировать run/session и проверить expected revision;
6. вставить command/event receipt;
7. вычислить transition/effect plan;
8. применить DB-effects через ports;
9. сохранить progress, decisions, assets, operations и dirty keys;
10. commit;
11. построить response из committed read model;
12. выполнить wake/push; при потере push клиент перечитает состояние.

Ошибка на шагах 2–9 откатывает всё. Ответ не строится из speculative mutation.

## Publication и изменение квеста

Quest definition immutable. При candidate activation compiler вычисляет impact
по semantic digest.

Принятая baseline policy владельца: изменённый квест отменяется у всех активных
игроков; завершённая history сохраняется; archived quest не предлагается снова.
Технически activation plan обязан:

1. перечислить changed/removed quest keys и число active runs;
2. проверить, что cancellation/asset cleanup выполнимы;
3. отменить runs и DB-owned temporary assets одной контролируемой операцией;
4. записать immutable history reason `definition_replaced`;
5. активировать release только после успешной отмены;
6. поставить внешние cleanup intents и projection refresh.

Для слишком большого набора activation переходит в explicit maintenance job и
не меняет active pointer до завершения. Silent lazy mixing revisions запрещён.

## Module ports, которые понадобятся

- `QuestHeroLock`/существующий character lock;
- `QuestInventoryPort` с instance-aware grant/consume и результатом provenance;
- `QuestCharacterEffects` для money/exp/reputation/profession;
- `QuestRecipeEffects`;
- `QuestPartySnapshot` с membership/area/copy/alive eligibility;
- `QuestWorldQuery` и `QuestWorldEffect`;
- `QuestEncounterPort`;
- `QuestNotificationPort` только post-commit;
- `QuestClock` и injectable decision RNG на application boundary.

Порты должны быть узкими capability interfaces. Quest module не получает целые
`InventoryService`, `CharacterService`, `WorldService` и `CombatPort`.

## Обязательные enabling changes

Это не открытые продуктовые вопросы, а технические зависимости первых slices:

1. Command adapters создают стабильный `operationId` до первой mutation и
   передают его всем участвующим модулям. Отсутствие client request id не
   разрешает генерировать новый id при каждом retry внутри одной операции.
2. Inventory возвращает identity/provenance созданных и объединённых lots и
   сохраняет её при split/merge. До этого временный stackable quest item
   выдаётся отдельным несмешиваемым instance.
3. Combat принимает `encounterId` при старте и возвращает его в terminal
   settlement/event. Один только in-memory callback не является связью.
4. Запуск боя, таймер и другое внешнее действие идут через durable
   `quest_operations`. Потерянный UI wake не восстанавливается outbox-ом: клиент
   перечитывает projection, а wake лишь ускоряет это.
5. Первый implementation slice удаляет старые quest tables/runtime/content и
   проверяет, что composition root больше не импортирует старый модуль. Переноса
   cursor/progress нет.

## Implementation sequence

1. Удалить старый quest runtime, tables, synthetic content и связанные тесты;
   оставить явно падающие/пустые wire routes до появления нового facade.
2. Ввести compiled definition v1 и publication validator.
3. Создать новую persistence schema/repositories и characterization tests.
4. Реализовать pure transition engine для одного current objective с composite
   requirements.
5. Реализовать command/event receipts и transactional DB effects.
6. Подключить linear tracer через новый facade и client wire adapter.
7. Добавить dialog sessions/check decisions.
8. Добавить waits/encounters и restart reconciliation.
9. Добавить cancellation asset ledger, branching/outcomes, repeat/party.
10. Подключать игровые hooks к typed events только по мере появления tracer,
    не создавая заглушки старого поведения.

Каждый шаг заканчивается raw-AMF E2E, PostgreSQL reconnect/restart test и
fail-fast test отсутствующей registry capability.
