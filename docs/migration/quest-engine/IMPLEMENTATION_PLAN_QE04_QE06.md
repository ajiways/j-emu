# Quest engine: implementation plan QE-04 — QE-06

> **Статус:** очередь после QE-03 checkpoint. Здесь появляются реальный client
> interaction flow, provenance предметов, waits и quest fights.

## Dependency graph

```text
QE-03 events/effects
   ├── QE-04 board/conditions
   │      └── QE-04A dialog sessions/checks
   │             ├── QE-04B item/standalone interactions
   │             └── QE-04C journal/tracker/wire
   ├── INV-01 inventory provenance lots
   │      └── QE-05 assets/recovery
   │             └── QE-05A transformations
   └── OPS-01 durable operations/fact outbox/waits
          └── COMBAT-01 encounter purposeRef/outbox
                 └── QE-06 world/AREA/combat tracer
```

INV-01 и OPS-01 — общие platform capabilities, не внутренние quest hacks. Их
можно реализовывать параллельно с QE-04 после стабильного QE-03 API.

## QE-04 — conditions и universal board

### 04.1. Evaluation snapshot builder

Собрать под hero lock единый snapshot:

- character level/money/reputation/professions;
- area/instance;
- inventory counts;
- quest active/history/run/world facts;
- party summary;
- entitlements;
- injected `now`.

Condition handlers pure. Board, direct command authorization, dialog options и
marker projections используют один evaluator/compiled condition, а не копии
проверок.

### 04.2. Host/entry compiler и resolver

- compiled host index active release;
- host intro variants;
- entry slot/priority/order;
- semantic marker intent;
- owner dispatcher quest/dialog/store/storage/activity/service;
- hidden entries отсутствуют в response;
- direct open повторяет authorization.

Первый supported host — NPC. Item instance и area object подключаются после
session/provenance contracts.

### 04.3. Conditions baseline

Реализовать и протестировать:

- level;
- quest history/active/stage;
- run/world facts;
- reputation/profession;
- area/instance;
- artifact count;
- entitlement;
- all/any/not.

Time windows и party predicates добавляются с отдельными clock/snapshot tests,
не через локальные `Date` вызовы.

### 04.4. Acceptance

- один NPC показывает несколько квестов и standalone entries;
- welcome text меняется от reputation/history;
- недоступная entry отсутствует, direct request denied;
- completion одного квеста атомарно меняет board/marker другого;
- одинаковый snapshot даёт одинаковые board/dialog/availability results.

## QE-04A — dialog runtime

Реализуется по `DIALOG_RUNTIME_SPEC_V1.md`:

1. compiler scene/node/answer graph;
2. `dialog_sessions`/decisions/check attempts;
3. open/reopen/close/invalidate commands;
4. screen projection presenter/body/answers;
5. answer transaction → quest semantic action/effects;
6. persisted probability/skill check;
7. end actions close/board/map.

Tracer TQ-12 обязан включать:

- несколько pre-accept screens;
- back/cycle;
- отдельные active/ready NPC texts;
- смену presenter;
- speech check success/failure;
- close до/после decision;
- reconnect и duplicate answer.

Wire adapter дополнительно фиксирует client-specific invariants из
`CLIENT_WIRE_CONTRACT_V1.md`: `jump` имеет терминальный приоритет, false
`to_fight` кодируется отсутствием поля, а `waiting_time` answer является
pre-submit presentation и не создаёт persisted wait.

UI reward selection проходит dialog `claim_reward` node с clickable semantic
package choices; wire icon rendering остаётся adapter responsibility.

## QE-04B — standalone и item-hosted interactions

- общий scene runtime без создания quest history;
- item instance owner/generation;
- rotating variant persisted decision;
- store/storage/service owner entry;
- entitlement заменяет locked entry открытой;
- safe cyclic chatter.

TQ-14 моделирует «Голову мертвеца»: каждый новый episode может выбрать новый
dialog, reopen одного episode не reroll-ит. TQ-17 моделирует покупку доступа к
складу и замену board entry.

## QE-04C — journal, tracker и client wire

### Semantic projections

- list active/completed/repeat cooldown;
- один current target на active stable stage;
- completed target history;
- counters составной цели;
- reward preview/selection;
- related monsters/area objects/NPC markers;
- hidden wire counters для world gating отдельно от target progress counters;
- favorite/tracked/selected UI states отдельно от run.

### Wire workflow

Для каждой surface сначала фиксируется raw client fixture:

- board empty/multi-entry;
- dialog screen + answers + presenter override;
- reward choice icons;
- book list/targets/counters/history/cooldown;
- tracker/favorite;
- marker/map affordance;
- macros text/icon/NPC navigation.

Первичный regression source — сохранённый `reg_6lvl`: из него выделяются
малые fixtures accept/turn-in, sequential targets, choice award, ORATORY,
`to_fight`, shadow rows и AREA waiting/ambush. Большой research JSON не
подключается напрямую к обычному test run.

Adapter реализуется golden fixture tests. Semantic model не принимает поля с
непонятным смыслом только ради совпадения dump; неизвестное остаётся evidence
issue до подтверждения.

**Checkpoint QE-04:** TQ-12/14/17/18–21 проходят semantic integration tests и
подтверждённые surfaces — raw-AMF/CEF fixtures.

## INV-01 — provenance-aware inventory

Отдельный changeset до quest assets:

1. migration `inventory.item_lots` + baseline backfill;
2. grant возвращает lot mutations вместо `void`;
3. consume/drop/use/sell/trade/mail/split/merge сохраняют lots;
4. operation idempotency;
5. reservation/binding policy;
6. durable inventory facts;
7. consistency constraint/reconciliation.

Сначала переписываются inventory unit/integration tests. Quest engine
подключается только после зелёного lot invariant на всех write paths.

## QE-05 — quest assets и recovery

### 05.1. Asset ledger/effects

- `grant_item` temporary/permanent;
- consume/deliver exact selector;
- asset generation;
- expiry/recovery policy;
- cancellation cleanup;
- item-loss facts;
- no-refuse/reissue scene.

### 05.2. TQ-1 Linear exchange

- accept выдаёт временный предмет;
- drop → authored recovery/reissue;
- wrong NPC/area не consume;
- delivery проверяет и списывает атомарно;
- cancel удаляет только asset run;
- duplicate/restart безопасны;
- reward overflow работает.

### 05.3. QE-05A Transform

Реализовать общий inventory transaction primitive:

- несколько inputs consume/reserve/require-only;
- guards area/table/profession/equipment/effect;
- output provenance;
- trigger item/NPC/AREA/recipe;
- optional persistent wait;
- atomic all-or-nothing.

TQ-6: A/B/C собираются в любом порядке, transform вместе, retry не дублирует
output, потеря компонента корректно меняет readiness.

**Checkpoint QE-05:** ни один cleanup/consume не использует только artifact id;
все temporary assets имеют owner/generation и проходят concurrency tests.

## OPS-01 — durable operations/facts/waits

Реализуется до quest fight:

- generic leased worker framework;
- `quests.operations`;
- shared `game_fact_outbox`;
- `quests.waits`;
- request-time catch-up;
- post-commit wake distinction;
- fault-injection harness для crash windows.

Первый tracer — harmless authored wait с message → timer → run fact. Затем wait
подключается к item interaction/AREA action.

## COMBAT-01 — encounter integration

Изменения combat без quest imports:

- purposeRef metadata;
- idempotent external start key;
- inspect active fight by purposeRef;
- terminal fact outbox в settlement UoW;
- explicit abort/recovery outcome;
- participant snapshot.

Затем quest encounter coordinator добавляет persistent binding/reconciliation.

## QE-06 — world, AREA и combat

### 06.1. Personal world projection

- permanent `hero_world_facts`;
- host/object visible/hidden/replaced variants;
- stale board/dialog invalidation;
- area action authorization;
- projection dirty dependencies.

### 06.2. Interaction pipeline

- valid/wrong area/wrong order/missing/expired/cooldown fallback cases;
- chat/popup/wait response;
- consume timing never/start/success;
- reservation during wait;
- ordered multiple points;
- resulting event/effect/branch.

### 06.3. Quest encounters

- persistent start operation;
- authored allies/enemies snapshot;
- win/loss/leave/recovery;
- chained encounters;
- reconnect/restart;
- personal loot/reward;
- no progress from absent RAM state.

TQ-4 должен пройти сценарий use item → AREA point → wait → fight → win/loss
branch со crash injection на каждой границе.

### 06.4. Permanent branch tracers

- TQ-8 Грого: friend/exile outcome меняет персональный world/board/dialog;
- TQ-10 Бык: atomic succession bundle без промежуточного двойного атамана;
- отмена run не откатывает committed permanent outcome.

**Checkpoint QE-06:** waits/fights/world state переживают restart, wrong-context
поведение authored, а combat/inventory/world не зависят от quest module.

## Сквозные проверки

На каждом slice:

- duplicate/reorder/stale generation;
- concurrent cancel/use/finish;
- rollback owning-service denial;
- process restart до/после commit;
- direct hidden request;
- handler/version missing fail-fast;
- no `questKey` condition в production;
- raw client fixture только для уже исследованной surface.
