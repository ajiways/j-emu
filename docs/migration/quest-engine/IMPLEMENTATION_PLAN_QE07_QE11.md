# Quest engine: implementation plan QE-07 — QE-11

> **Статус:** завершающие server capabilities после QE-06. После этого можно
> массово переносить квесты и начинать отдельный UI editor project.

## QE-07 — rewards и outcomes

- named packages all/choose-one;
- semantic reward choice projection;
- exp/money/item/reputation/profession/recipe/assistant/entitlement ports;
- atomic outcome bundles;
- permanent personal world facts/dispositions/succession;
- exactly-once terminal history.

Tracers: TQ-3 full branch packages, TQ-10 succession, TQ-13 profession pair.
Exit: rollback каждого effect ordinal не оставляет partial reward/outcome.

## QE-08 — repeatability/history

- run attempt/cycle allocation;
- once/immediate/duration cooldown;
- anchors accepted/completed/reward claimed;
- repeat claims/history projections;
- FakeClock/request catch-up/archive behavior.

Exit: час/день/неделя одинаково работают через duration, каждая попытка имеет
отдельные decisions/assets/receipts/history.

## QE-08A — activities и services

### Activity/reward track

- persistent challenge index;
- tier thresholds;
- encounter sequence/allies;
- independent reward claim cooldown;
- TQ-15 «Сферы мага».

### Service invocation

- route catalog/conditions/quote;
- payment reservation/debit policy;
- provider presentation + wait;
- atomic/reconciled arrival;
- interrupt/refund;
- TQ-16 paid travel/ship captain.

Exit: ни activity, ни travel не создают фиктивную quest history.

## QE-09 — party progress

- authoritative PartySnapshot port;
- personal/same-area/same-instance/participants;
- online/alive/participated filters;
- sorted multihero locks;
- personal runs/assets/loot/rewards;
- fan-out audit/dispositions.

TQ-5 покрывает разные stages/progress двух участников, join/leave race и
duplicate combat fact.

## QE-10 — rollout

### Classification

Compiler diff выдаёт presentation-only/behavior changed/removed. Active run
всегда pinned; silent mix запрещён.

### Policies

- `reject_if_active` — baseline ранних этапов;
- `cancel_active_runs` — выбранная project policy после asset cleanup support;
- presentation-only может активироваться без изменения stored run semantics,
  но history snapshots не переписываются.

### Batch rollout

Для большого числа runs:

1. candidate становится `retiring/preparing`, новые accepts закрыты;
2. resumable batches cancel runs и clean assets;
3. failures/attempts видимы;
4. active pointer меняется только после полного success;
5. crash продолжает plan, не начинает заново.

Никакой hot mapping active node между revisions в v1.

## QE-11 — authoring API

Реализовать `AUTHORING_API_V1.md` поверх общего content editor:

- CRUD/archive/clone;
- typed catalogs;
- schema/compile/cross-content validation;
- graph/dialog simulator;
- semantic/client preview;
- diff/impact/rollout;
- audit.

API сначала используется CLI/integration tests. UI не является условием server
DoD.

## Final server acceptance

- все TQ-1…TQ-21 выражены без quest-specific production code;
- raw client fixtures покрывают используемые board/dialog/book/tracker/AREA
  surfaces;
- restart/fault injection для waits/encounters/rewards/services;
- PostgreSQL concurrency/lock stress для hero/party;
- candidate validation не пропускает missing handler/reference/path;
- archive/rollout/history корректны;
- operator создаёт и публикует квест без file/SQL patch;
- observability связывает operation/event/run/session/encounter/release.

## После server DoD

Отдельный `j-content-editor` строится поверх API:

1. catalog/wizard;
2. linear form editor;
3. graph/dialog editor;
4. state matrix и close/reopen preview;
5. exact client surface preview;
6. issues navigation;
7. diff/publish/rollout UX;
8. playtest simulator с FakeClock/RNG.

Editor не добавляет новую семантику: любое новое поле сначала появляется в
versioned server schema/compiler/runtime contract.
