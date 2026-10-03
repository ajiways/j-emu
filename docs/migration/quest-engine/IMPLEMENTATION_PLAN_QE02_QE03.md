# Quest engine: implementation plan QE-02 / QE-03

> **Статус:** очередь после checkpoint QE-01. QE-02 доказывает общий graph и
> составную цель, QE-03 подключает реальные domain facts и effects. Диалоги,
> waits, encounters и party fan-out сюда не входят.

## Входные условия

- старый runtime удалён;
- TQ-0 работает на новой schema;
- definition pin/run/history/receipts переживают restart;
- compiler, registry и facade boundaries соответствуют v1 contracts;
- все новые changes идут через public module ports.

## QE-02 — graph interpreter core

### 02.1. Compiled graph model

Реализовать exact compiled variants:

- stable: `objective`, `choice`, `reward`;
- instantaneous: `gate`, `sequence`, `bounded_repeat`, `end`;
- control frames sequence/repeat;
- `(nodeKey, activation)` identity;
- requirement progress с typed payload/handler version;
- append-only decisions.

Compiled objects immutable (`Readonly`, frozen test fixtures). Runtime lookup
делается map-ом по semantic key; authored array scan в hot path не нужен.

### 02.2. Pure engine

Реализовать без repository mocks внутри domain:

- enter/activate/complete stage;
- completion `all/any/at_least/ordered`;
- fixed-point closure с compiler hop budget;
- choice commit;
- reward ready/selection/terminal;
- activation generation;
- planned overlay для run facts;
- deterministic audit trail/effect keys.

Первые handlers:

- `talk`, `talk_set`;
- condition `level`, `quest_history`, `stage_active`, `run_fact`;
- effects `set_run_fact`, `grant_experience`.

### 02.3. Persistence additions

Если QE-01 minimal schema их ещё не содержит:

- `run_decisions`;
- `run_facts`;
- serialized/normalized control frames;
- stage activation counter;
- journal snapshot завершённого stage.

Control state должен быть queryable для recovery/debug. Один opaque run-state
JSON без constraints допускается только для compiled immutable definition, не
для lifecycle state.

### 02.4. Tracers

**TQ-2 Composite patrol**:

- одна player-facing цель;
- `talk_set` A/B/C;
- любой порядок;
- три counters;
- повтор одного NPC не даёт второй progress;
- future target не виден.

**TQ-7 Interleaved bounded lesson**:

- bounded repeat двух итераций;
- sequence talk A → talk B внутри каждой итерации;
- event generation первой итерации не закрывает вторую;
- после max iterations переход к reward/end.

**TQ-3 skeleton branch**:

- choice с двумя options;
- persisted decision;
- join в общий reward;
- без dialog UI и branch-specific сложных effects.

### 02.5. Tests

Unit/model:

- exhaustive transition table всех node types;
- graph closure termination;
- permutation для commutative requirements;
- ordered mismatch ignore/reset;
- activation isolation;
- choice replay/conflict;
- unique operation keys;
- no active stage only at terminal.

PostgreSQL:

- decision/progress/history restart;
- concurrent events под hero lock;
- rollback midway through multi-stage closure;
- completed journal snapshots не меняются с новой release;
- no future target leakage в read projection.

**Exit:** TQ-2/TQ-7/TQ-3 skeleton исполняются одним engine без `questKey`
branches и без I/O внутри transition function.

## QE-03 — event router и effects

### 03.1. Event intake

Реализовать `QuestEvents.apply()`:

- strict `quest-event.v1` parser;
- canonical digest;
- interest-index candidate lookup;
- sorted hero/run locks;
- `(eventId, runId)` receipts с applied/ignored/duplicate disposition;
- authoritative context snapshot;
- вызов engine и atomic writes;
- projection revision/wake после commit.

Первоначально fan-out ограничен одним actor hero. Party participants появляются
в QE-09; envelope поддерживает их заранее, но router не выдаёт shared credit
без реализованного policy handler.

### 03.2. Owning-module event ports

Не добавлять quest callbacks обратно. Owning service возвращает typed domain
fact своего модуля, а application orchestrator передаёт его neutral sink:

```ts
interface GameFactSink {
  publishInTransaction(fact: GameDomainFact, session: DatabaseSession): Promise<void>;
  publishAfterCommit(fact: GameDomainFact): Promise<void>;
}
```

Quest event adapter в `app` преобразует поддерживаемый `GameDomainFact` в
`QuestEvent`; inventory/combat/store не импортируют quest types. Это не
произвольный JSON bus: `GameDomainFact` — закрытая discriminated union shared
application contracts, у каждого producer есть owner и schema tests.

Название может измениться, но semantics обязана различать:

- факт в текущей общей UoW;
- факт уже завершённой external/RAM operation;
- отсутствие quest consumers как нормальный no-op.

Первый adapters set:

- committed NPC interaction → `npc.interaction_completed`;
- один inventory mutation path → `inventory.items_added/removed` только после
  появления lot/provenance identity;
- store/craft/combat не подключаются фиктивно до своих payload/tests.

### 03.3. Transactional effects

Effect executor registry сначала поддерживает:

- `grant_experience`;
- `set_run_fact`;
- один inventory-independent reward package.

Затем отдельно добавляются money/reputation через owning ports. Каждый executor:

- принимает operation key;
- возвращает result/derived facts;
- либо имеет idempotency в owning service, либо использует effect receipt;
- не ловит denial как success;
- не формирует client wire.

Inventory effects блокируются до provenance-aware API. Это явная dependency, а
не повод временно удалять предметы по `itemId`.

### 03.4. Derived event queue

Внутри UoW:

- stable id `effect operation key + ordinal`;
- FIFO по deterministic effect order;
- depth/count limit;
- cycle detection;
- каждый derived event проходит тот же router/receipt path;
- вся очередь commit-ится либо откатывается вместе.

Post-commit operation facts начинают новую facade UoW с сохранённым causation.

### 03.5. Error и observability mapping

Ввести codes из `APPLICATION_API_V1.md`, structured audit и metrics:

- accepted/applied/ignored/duplicate/conflict;
- candidate run count;
- transition/effect duration;
- receipt collision;
- invariant failure с release/quest/run/handler version.

Wire mapping пока нужен только там, где реально подключён command. Domain error
не содержит client text.

### 03.6. Tests

- duplicate event same digest;
- duplicate event conflicting digest;
- one event advances two active quests героя;
- no candidate run is successful no-op;
- rollback effect failure removes progress/receipts;
- derived event produces deterministic id;
- derived event cycle rolls back;
- process restart before/after commit;
- concurrent different events serialize without lost progress;
- unsupported handler never reports success.

**Exit:** TQ-0/TQ-2 progress может поступать через public event facade, effects
атомарны, replay безопасен, а ни один owning module не импортирует quest domain.

## Что запрещено тащить вперёд

- generic event bus без transaction semantics;
- arbitrary JSON event/effect payload;
- one giant switch в facade;
- callbacks `afterBagChange`/`recordBuy`/`afterFinished`;
- запуск fight из transactional effect;
- временный in-memory dedup;
- shared party progress до QE-09;
- dialog choice без persisted session до QE-04A.

## Checkpoint перед QE-04

- graph/receipts/effects покрыты model + PostgreSQL tests;
- event/effect contracts не знают wire;
- compiler artifact deterministic;
- TQ-2 проходит с одной текущей целью и несколькими counters;
- direct application requests защищены revision/ownership checks;
- новый capability добавляется одним registry member и tests, без изменения
  central transition switch.
