# Quest engine: repeat, activities and services v1

> **Статус:** normative contract QE-08/QE-08A. Repeatable quest, long-lived
> activity, recurring reward claim и travel service — разные aggregates.

## Repeatable quest

Каждая попытка создаёт новый run. Cycle key рассчитывает registered schedule:

- `once` — единственный lifetime key;
- `immediate` — attempt sequence;
- duration cooldown — absolute `nextAvailableAt` от authored anchor.

History каждого run immutable. Cooldown projection хранит server timestamps;
request-time catch-up делает доступность актуальной без обязательного worker.
Изменение duration новой release не переписывает уже назначенный cooldown.

## Activity progress

Сферы мага моделируются не 35 повторными quests:

```text
ActivityProgress
  hero/activity key
  definition release
  current challenge index
  unlocked reward tier
  revision
  active encounter nullable
```

Challenge sequence имеет authored roster/allies и bounded length. Победа
продвигает index, иногда повышает tier. Progress не сбрасывается после claim.

## Reward claim track

Отдельный aggregate:

```text
RewardClaimTrack
  hero/activity/track
  unlocked tier
  last claimed tier snapshot
  lastClaimedAt/nextAvailableAt
  claim revision
```

Claim выдаёт package tier, разблокированный на момент locked transaction, и
назначает cooldown. Он не запускает следующий phantom и не меняет challenge
progress. Duplicate operation не выдаёт вторую сферу.

## Service invocation / travel

```text
ServiceInvocation
  id/hero/provider/route
  quote snapshot
  source/destination
  state quoted|waiting|committing|completed|cancelled|failed
  wait id
  payment reservation/debit policy
  presentation/provider snapshot
  operation keys/revision
```

Flow:

1. board resolver показывает доступные routes;
2. command повторно проверяет source/time/entitlement/price;
3. создаёт quote + payment reservation/debit according policy + wait;
4. projection показывает provider-specific travel presentation;
5. wait completion атомарно проверяет invocation и перемещает героя;
6. commit money/location/facts, затем presence/wire wake.

Destination — typed world reference, не dialog text. Капитан/перевозчик лишь
host/presenter service definition.

## Interrupt/refund

Каждый route задаёт:

- interrupt allowed;
- debit at start или completion;
- refund full/partial/none;
- behavior if destination unavailable after wait;
- reconnect/request-time catch-up.

Money и movement нельзя разнести двумя независимыми commits. Если world move
не может участвовать в общей UoW, service использует reservation + durable
commit operation и остаётся `committing` до reconciliation.

## Tests

- 1h/1d/1w FakeClock + restart;
- new run per cycle/history isolation;
- phantom progress и tier thresholds;
- claim cooldown независим от activity progress;
- duplicate encounter/claim;
- travel quote stale/price changed;
- wait/reconnect/downtime;
- payment/move crash windows;
- interrupt/refund races;
- provider-specific projection и multiple routes.
