# Quest engine: encounter coordinator v1

> **Статус:** целевой contract QE-06. Combat hot state остаётся RAM-only, но
> quest intent, binding, roster, terminal fact и recovery сохраняются.

## Текущая проблема

Существующий combat terminal observer получает `fightId/outcome/purpose` после
settlement, но quest callback не атомарен с settlement. RAM fight исчезает при
restart. Поэтому простой `startFight(); await callback` не может гарантировать
ни один старт, ни один terminal progress.

## Encounter aggregate

```text
quests.encounters
  id bigint identity PK
  run_id
  node_key/activation
  encounter_key
  generation
  state ready|start_pending|active|terminal_pending|won|lost|abandoned|recovery
  start_operation_key unique
  fight_id text unique nullable
  roster_snapshot jsonb
  participant_snapshot jsonb
  random_seed text
  recovery_policy text
  terminal_fact_id text nullable
  revision integer
  timestamps
```

Unique active generation на `(run,node,activation,encounter_key)`. Roster,
allies, scaling inputs и seed pin-ятся до запуска; retry/recreate не бросает
новый состав противников.

## Combat port

```ts
interface QuestEncounterPort {
  start(input: StartQuestEncounter): Promise<StartEncounterResult>;
  inspectByPurposeRef(encounterId: string): Promise<EncounterCombatState>;
  abandon(input: { encounterId: string; operationKey: string }): Promise<AbandonResult>;
}

type StartQuestEncounter = Readonly<{
  operationKey: string;
  encounterId: string;
  heroIds: readonly number[];
  roster: EncounterRosterSnapshot;
  seed: string;
  presentation: EncounterPresentation;
}>;
```

Combat сохраняет `purposeRef={kind:"quest_encounter", encounterId}` в fight
metadata и возвращает его в terminal fact. Повтор start operation:

- находит тот же live fight и возвращает его id;
- либо создаёт один новый fight, если idempotency record ещё не completed;
- никогда не создаёт второй live fight для encounter generation.

## Start flow

Quest transition:

1. под hero/run lock создаёт encounter `ready` и `start_encounter` operation;
2. сохраняет stage checkpoint;
3. commit.

Worker:

1. claim operation без удержания hero DB lock во время RAM call;
2. combat проверяет отсутствие несовместимого active fight;
3. создаёт fight с purposeRef/idempotency key;
4. worker отдельной UoW bind-ит `fightId`, state `active`;
5. stale/duplicate result сверяется по encounter/fight identity.

Если герой уже в другом бою, policy выбирает retryable `hero_busy` либо failed
authored recovery; silent replacement боя запрещён.

## Terminal flow

Combat settlement UoW:

1. фиксирует обычные combat rewards/resources/history;
2. пишет `game_fact_outbox` terminal fact с fight/purposeRef/outcome/participants;
3. commit;
4. best-effort wake.

Fact consumer:

1. resolve encounter по purposeRef;
2. lock heroes/run/encounter;
3. проверить fight id, generation и state;
4. записать quest event receipt;
5. `won|lost|escaped|aborted` переводит encounter по authored policy;
6. transition engine двигает requirement/branch;
7. commit и помечает fact delivered.

Duplicate terminal fact возвращает тот же disposition. Fight без quest
purposeRef идёт в обычные `combat.*` requirements, но не может закрыть
`win_encounter`.

## Allies и participants

Authored allies входят в roster snapshot как combatants, но не heroes и не
получают quest run/reward. Party heroes фиксируются `participant_snapshot` при
старте, однако credit при terminal повторно проверяется по configured policy.

Participant snapshot нужен для `participated`; текущий состав party после боя
не переписывает факт участия.

## Последовательные quest fights

Каждый start создаёт новую encounter generation. Stage может требовать N wins
или несколько encounter keys. Следующий start разрешён только после terminal
state предыдущего либо явного parallel policy будущей версии.

`fightId` никогда не используется как authored identity; он instance конкретного
запуска.

## Restart reconciliation

После process restart coordinator сканирует non-terminal encounters:

### `ready/start_pending`, live fight отсутствует

Повторить start operation с тем же key/seed/roster.

### `active`, live fight найден

Восстановить binding/worker state, ничего не создавать.

### `active`, live fight отсутствует, terminal fact найден

Доставить fact и завершить encounter.

### `active`, ни fight, ни terminal fact

RAM state потерян. Применить authored recovery:

- `recreate` — новая combat instance с тем же encounter generation, новым
  fightId, тем же roster/seed; старый fight id сохраняется audit trail;
- `return_to_ready` — закрыть потерянную attempt как recovery и разрешить
  игроку начать снова;
- будущий explicit failure edge — только если product evidence это требует.

Награда/progress не выдаются по одному факту отсутствия RAM fight.

## Loss, leave и disconnect

Combat terminal outcomes mapping:

- `win` → won;
- `loss` → lost;
- `last-leave/escape` → authored lost/return-to-ready/branch;
- server abort → recovery, не player loss по умолчанию.

Disconnect без terminal combat outcome не завершает encounter. Reconnect
показывает live fight либо recovery state.

## Cancellation

- `deny_while_active`: cancel command отклоняется для start_pending/active;
- `abandon`: DB state/operation cancellation commit-ится, затем durable abandon
  operation просит combat закрыть fight;
- поздний terminal fact abandoned encounter получает ignored receipt и не
  двигает run;
- combat settlement остаётся валидным в своём aggregate, даже если quest уже
  отменён.

## Loot

Quest-specific guaranteed loot не определяется запросом `needed()` во время
payout. Возможные механизмы:

- encounter roster/reward snapshot содержит персональный loot grant operation;
- обычный combat loot создаёт inventory fact, который продвигает acquire goal;
- personal quest loot планируется per eligible hero exactly once.

Random loot roll и quest progress имеют отдельные persisted decisions. Нельзя
повторно бросать loot из-за retry terminal fact.

## Required combat changes

- purposeRef в fight metadata и terminal notice;
- start idempotency по external operation key;
- lookup live fight by purposeRef;
- durable terminal fact в settlement UoW;
- explicit outcome `aborted`/server recovery distinction;
- stable participants/contribution snapshot;
- никаких quest imports внутри combat domain.

## Tests

- duplicate start создаёт один live fight;
- crash в каждом окне start/bind/terminal/delivery;
- restart active fight present/missing/terminal fact pending;
- stale terminal старого fight после recreate;
- win/loss/leave/abort mapping;
- cancellation deny/abandon race;
- chained encounters;
- authored allies roster pin;
- two party heroes personal credit/reward;
- ordinary hunt не закрывает quest encounter;
- terminal settlement commit без immediate observer всё равно доставляется;
- no reward/progress from missing RAM state alone.
