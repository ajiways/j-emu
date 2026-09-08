# Очередь переноса capabilities

Это канонический порядок работ. Продуктовый факт «что уже работает» хранится
только в [CAPABILITIES.md](../CAPABILITIES.md), а повторяемый процесс — в
[PLAYBOOK.md](PLAYBOOK.md). Граница evidence задана
[SOURCE_BOUNDARY.md](SOURCE_BOUNDARY.md), карта источников —
[EVIDENCE_INDEX.md](EVIDENCE_INDEX.md), известные точки изменения ownership и
общей архитектуры — [ARCHITECTURE_EVOLUTION.md](ARCHITECTURE_EVOLUTION.md).

## Правила очереди

- Порядок записей обязателен; capability берётся только после всех
  `depends_on`.
- Workflow-статусы: `done`, `next`, `queued`, `post-core`, `deferred`,
  `excluded`. Они не заменяют продуктовые статусы.
- Ровно одна запись имеет статус `next`: **CHR-02**.
- Architecture checkpoint заполняет architecture agent до coding. Допустимые
  итоги: действующие ADR достаточны; нужен новый ADR; нужен отдельный
  `ARC-*`; capability надо переупорядочить.
- `Content set` перечисляет только authored data capability. Player/runtime
  state не является content.
- Детали контрактов живут в `docs/modules/*` и `WIRE_INVARIANTS.md`; очередь их
  не дублирует.

## Wave 0 — завершённая основа

### FND-01 — Runtime foundation

- **ID:** `FND-01`
- **depends_on:** —
- **Behavior evidence:** [legacy architecture](../../../jgr-emu/docs/ARCHITECTURE.md),
  [wire protocol](../../../jgr-emu/docs/PROTOCOL.md).
- **Content set:** versioned draft/release/publication foundation.
- **Architecture checkpoint / decision:** complete; ADR-0017, ADR-0018,
  ADR-0019 and ADR-0020.
- **Acceptance:** PostgreSQL/Drizzle, database IDs, typed static dispatch,
  active-combat boundary and E2E harness pass their existing gates.
- **Status:** `done`

### AUT-01 — Client origin, auth and session

- **ID:** `AUT-01`
- **depends_on:** `FND-01`
- **Behavior evidence:** legacy `REDIRECT.md`, `FILES.md`, auth routes and
  [wire invariants](WIRE_INVARIANTS.md).
- **Content set:** Pub1 files are external static input; no authored runtime
  content.
- **Architecture checkpoint / decision:** complete; ADR-0017 and ADR-0019.
- **Acceptance:** HTTPS/CEF login, HTTP-200 cookie handoff, reconnect and Pub1
  root paths work in raw route tests and CEF.
- **Status:** `done`

### BST-01 — Character bootstrap

- **ID:** `BST-01`
- **depends_on:** `AUT-01`
- **Behavior evidence:** legacy bootstrap/hero builders,
  `CHARACTER_STATS.md`, `HP_REGEN.md` and
  [CHARACTER.md](../modules/CHARACTER.md).
- **Content set:** level boundaries, appearance presets, HUD defaults, skill
  definitions, game-wide documents, starter hero policy and area 503 slice.
- **Architecture checkpoint / decision:** complete; ADR-0017 through ADR-0019.
- **Acceptance:** flat `init/init2`, HUD, bag/pocket/magic/view and area survive
  reconnect and process restart; CEF reaches the playable HUD.
- **Status:** `done`

### INV-01 — Paperdoll PUT_ON/PUT_OFF

- **ID:** `INV-01`
- **depends_on:** `BST-01`
- **Behavior evidence:** legacy `TRAVEL_BAG.md`, item/stat rules and
  [INVENTORY.md](../modules/INVENTORY.md).
- **Content set:** starter glove 9095, artifact projection and skill metadata.
- **Architecture checkpoint / decision:** complete; existing module boundaries
  and ADR-0018/ADR-0019.
- **Acceptance:** glove 9095 equip/unequip, displacement, vitals, bag and view
  remain consistent through reconnect/restart and pass CEF.
- **Status:** `done`

## Wave 1 — character and inventory core

### CHR-01 — EXP and level progression

- **ID:** `CHR-01`
- **depends_on:** `BST-01`, `INV-01`
- **Behavior evidence:** legacy `CHARACTER_STATS.md`, `FIGHT_LOOT.md` and
  [CHARACTER.md](../modules/CHARACTER.md).
- **Content set:** contiguous DATA-01 level boundaries and normalized naked
  progression skill values. L1–L6 skill values are confirmed evidence; higher
  values keep explicit legacy-extrapolation provenance.
- **Architecture checkpoint / decision:** complete — existing ADRs and module
  boundaries are sufficient; no `ARC-CHAR` and no combat dependency. Character
  owns the idempotent EXP operation and its persisted result; catalog supplies
  one immutable progression snapshot; inventory supplies a read-only equipped
  modifier snapshot. The hero row is the lock and all character writes are one
  Unit of Work. Full contract: [CHARACTER.md](../modules/CHARACTER.md).
- **Acceptance:** `grantExperience` rejects invalid, conflicting, overflowing,
  inconsistent or out-of-published-curve input without mutation; no-level,
  one-level and multi-level grants atomically persist EXP/level, managed naked
  skills, equipment-derived maxima and HP/MP scaled exactly once. Duplicate
  operation IDs return the same persisted result, conflicting reuse fails, and
  concurrency/rollback/reconnect/restart are covered. Published `bag_cnt` is
  resolved from the resulting boundary and remains 2 throughout L1–L8; actual
  capacity enforcement belongs to `INV-02`. CHR-01 adds no fake OA: until
  CMB-03 or a quest flow consumes the port, character progression remains
  product-status `partial` and has no independent CEF gate.
- **Status:** `done`

### CHR-02 — HP/MP regeneration

- **ID:** `CHR-02`
- **depends_on:** `CHR-01`
- **Behavior evidence:** legacy `HP_REGEN.md`, fight lifecycle and
  [CHARACTER.md](../modules/CHARACTER.md).
- **Content set:** validated HPREG policy fields; runtime timestamps are player
  state, not content.
- **Architecture checkpoint / decision:** pending — decide clock ownership,
  persisted timestamps, lazy calculation and combat resource snapshot
  boundary. Ghost/injury/resurrection remain `CMB-04`.
- **Acceptance:** HP/MP regeneration is deterministic from persisted time
  across reconnect/restart, clamps to current maxima and pauses in combat
  without requiring a per-hero background ticker.
- **Status:** `next`

### INV-02 — Bag rules and DROP

- **ID:** `INV-02`
- **depends_on:** `CHR-01`
- **Behavior evidence:** legacy `TRAVEL_BAG.md`, `items.ts`, `bagSlots.ts` and
  [INVENTORY.md](../modules/INVENTORY.md).
- **Content set:** artifact stack, weight, price, flags and bag-capacity fields
  required by levels 1–8.
- **Architecture checkpoint / decision:** pending — confirm inventory aggregate,
  locking and void-sell transaction ownership.
- **Acceptance:** DROP/void-sell, stack limits, capacity and concurrent
  mutations neither duplicate nor lose items and keep exact flat wire shapes.
- **Status:** `queued`

### INV-03 — Pocket mutations and quick access

- **ID:** `INV-03`
- **depends_on:** `INV-02`
- **Behavior evidence:** legacy `POCKET.md`, `TRAVEL_BAG.md`, `items.ts` and
  [INVENTORY.md](../modules/INVENTORY.md).
- **Content set:** pocket types, max counts, slot metadata and compatible
  artifact actions for the core slice.
- **Architecture checkpoint / decision:** pending — define pocket slot
  invariants and public inventory snapshot port for combat.
- **Acceptance:** merge/split/swap and quick-slot persistence match the client,
  reject invalid races and survive reconnect/restart.
- **Status:** `queued`

### INV-04 — Core consumable USE

- **ID:** `INV-04`
- **depends_on:** `INV-02`, `INV-03`
- **Behavior evidence:** legacy `INVENTORY_USE.md`, `bonuses.ts` and
  [INVENTORY.md](../modules/INVENTORY.md).
- **Content set:** food, ADD_HP, ADD_MP and DRINK actions required by the core
  hunt loop.
- **Architecture checkpoint / decision:** pending — define typed inventory
  action registry, resource-change port and consume/apply atomicity.
- **Acceptance:** supported consumables atomically change HP/MP/effects and
  consume the item; unsupported or context-invalid actions return exact
  `203 + error`. Quest scripts and dialog-opening items remain `IUS-01`.
- **Status:** `queued`

## Wave 2 — world, hunt and realtime

### WLD-01 — Area transitions

- **ID:** `WLD-01`
- **depends_on:** `INV-02`
- **Behavior evidence:** legacy `TRAVEL_BAG.md`, `AREA_SIDEBAR.md`,
  `areaActions.ts` and [WORLD.md](../modules/WORLD.md).
- **Content set:** level 1–8 areas, links, travel policy and area sidebar data.
- **Architecture checkpoint / decision:** pending — confirm world-owned
  location state and inventory/fight guard ports.
- **Acceptance:** COME_IN/exit validates authored links, applies travel time and
  persists the destination with matching state/area/hunt wire after restart.
- **Status:** `queued`

### RTM-01 — Personal and area realtime

- **ID:** `RTM-01`
- **depends_on:** `WLD-01`
- **Behavior evidence:** legacy `SYNC.md`, `routes/esrv.ts`,
  [WIRE_INVARIANTS.md](WIRE_INVARIANTS.md) and [WORLD.md](../modules/WORLD.md).
- **Content set:** none; channels and presence are runtime state.
- **Architecture checkpoint / decision:** pending — define outbox ownership,
  delivery lifetime and area/instance channel identity.
- **Acceptance:** two heroes receive correctly framed personal `2:` and area
  `131:` enter/leave/update events without playerbot shortcuts.
- **Status:** `queued`

### WLD-02 — Hunt spawn lifecycle and locks

- **ID:** `WLD-02`
- **depends_on:** `WLD-01`, `RTM-01`
- **Behavior evidence:** legacy `SYNC.md`, `BESTIARY.md`, `huntWorld.ts`,
  `huntSpawns.ts`, `huntWander.ts` and [WORLD.md](../modules/WORLD.md).
- **Content set:** core bestiary subset, area hunt spawns, routes and respawn
  policy.
- **Architecture checkpoint / decision:** pending — decide process-local spawn
  scheduler/lock lifetime and combat handoff port.
- **Acceptance:** movement/respawn reaches both clients, one concurrent attack
  wins, and restart clears ephemeral busy state without losing hero location.
- **Status:** `queued`

## Wave 3 — complete core combat

### CMB-01 — Turn loop and melee ordering

- **ID:** `CMB-01`
- **depends_on:** `WLD-02`, `CHR-02`
- **Behavior evidence:** legacy `FIGHT_MODEL.md`, `FIGHT_CAST_ACK.md`,
  `FIGHT_TURN_UI.md`, `FIGHT_TOASTS.md` and
  [COMBAT.md](../modules/COMBAT.md).
- **Content set:** core bot combat stats and fight configuration.
- **Architecture checkpoint / decision:** pending — freeze turn state machine,
  clock/RNG injection and outbound packet queue boundary before coding.
- **Acceptance:** L/C/R, grants, timers, opponent switch and deny toasts finish
  a deterministic hunt turn loop with exact melee strike/`rs` ordering.
- **Status:** `queued`

### CMB-02 — Pocket, glove, rage and aggro

- **ID:** `CMB-02`
- **depends_on:** `CMB-01`, `INV-03`
- **Behavior evidence:** legacy `POCKET.md`, `GLOVE_MAGIC.md`,
  `FIGHT_RAGE.md`, `FIGHT_CAST_ACK.md` and
  [COMBAT.md](../modules/COMBAT.md).
- **Content set:** core pocket/glove spell definitions, effects and costs.
- **Architecture checkpoint / decision:** pending — define immutable
  combat-ready inventory snapshot and effect registry; invented formulas must
  be labeled `legacy behavior`.
- **Acceptance:** client counters never double-spend; pocket/glove/rage/aggro
  packet order and restrictions match ordered raw-frame tests and CEF.
- **Status:** `queued`

### CMB-03 — Terminal settlement and loot

- **ID:** `CMB-03`
- **depends_on:** `CMB-01`, `CMB-02`, `CHR-01`, `RTM-01`
- **Behavior evidence:** legacy `FIGHT_LOOT.md`, `FIGHT_MODEL.md`,
  `CHARACTER_STATS.md`, wire finish evidence and
  [COMBAT.md](../modules/COMBAT.md).
- **Content set:** level 1–8 loot references, quantities, money and EXP rewards.
- **Architecture checkpoint / decision:** pending — define one terminal
  orchestration transaction across character/inventory ports and post-commit
  realtime delivery.
- **Acceptance:** win/loss/leave settles exactly once, persists HP/EXP/level and
  loot, then emits ordered loot/exit without ResultWaiting.
- **Status:** `queued`

### CMB-04 — Reconnect, locks and history

- **ID:** `CMB-04`
- **depends_on:** `CMB-03`
- **Behavior evidence:** legacy `FIGHT_RECONNECT.md`, `FIGHT_LOCK.md`,
  `FIGHT_JOIN.md`, ADR-0020 and [COMBAT.md](../modules/COMBAT.md).
- **Content set:** none beyond already published fight definitions.
- **Architecture checkpoint / decision:** pending — confirm process-local
  reconnect lifetime, guard port and 72-hour history cleanup ownership.
- **Acceptance:** reconnect before restart restores fight; restart abandons
  active state without partial settlement; gameplay locks and bounded history
  behave consistently; death produces persisted ghost/injury state and
  RESURRECT clears it by the confirmed legacy contract.
- **Status:** `queued`

## Wave 4 — quest dependencies and cycle 1–8

### ECO-01 — Quest-required stores

- **ID:** `ECO-01`
- **depends_on:** `WLD-01`, `INV-02`
- **Behavior evidence:** legacy `STORE.md`, store fixtures and quest references
  listed in [EVIDENCE_INDEX.md](EVIDENCE_INDEX.md).
- **Content set:** only stores, lots, prices and gates referenced by the curated
  1–8 chain.
- **Architecture checkpoint / decision:** pending — define store public port,
  currency/item transaction and release reference validation.
- **Acceptance:** required enter/list/buy scenarios are atomic, persist through
  reconnect and reject missing lot/currency/reference without fallback.
- **Status:** `queued`

### REP-01 — Quest-required reputation

- **ID:** `REP-01`
- **depends_on:** `CHR-01`
- **Behavior evidence:** legacy `REPUTATION.md` and quest reward/gate references
  listed in [EVIDENCE_INDEX.md](EVIDENCE_INDEX.md).
- **Content set:** only reputation tracks, rewards and gates required by the
  curated 1–8 chain.
- **Architecture checkpoint / decision:** pending — define reputation owner and
  transaction port for quest/combat grants.
- **Acceptance:** grants and gates use published references, are idempotent and
  appear in the expected player stats after reconnect.
- **Status:** `queued`

### CHT-01 — Required system notifications

- **ID:** `CHT-01`
- **depends_on:** `RTM-01`, `CMB-03`
- **Behavior evidence:** legacy `CHAT.md`, `QUEST_MACROS_CHAT.md`,
  `lootNotify.ts` and [EVIDENCE_INDEX.md](EVIDENCE_INDEX.md).
- **Content set:** only system templates and artifact/bot/map macros needed by
  fight settlement and quests.
- **Architecture checkpoint / decision:** pending — define post-commit
  notification port and personal-channel delivery without introducing the
  complete social/chat module.
- **Acceptance:** fight/loot system messages reach the correct hero through
  esrv with exact macros after durable settlement; failed delivery does not
  roll back committed rewards.
- **Status:** `queued`

### QST-01 — NPC board, dialogs and quest book

- **ID:** `QST-01`
- **depends_on:** `WLD-01`, `ECO-01`, `REP-01`
- **Behavior evidence:** legacy `QUESTS.md`, `QUEST_DIALOG.md`,
  `NPC_CATALOG.md`, `QUEST_BOARD_ICONS.md` and
  [QUESTS.md](../modules/QUESTS.md).
- **Content set:** core NPC catalog, portraits, dialogs, board actions and quest
  summaries.
- **Architecture checkpoint / decision:** pending — define quest content schema,
  typed dialog cursor and static command surfaces.
- **Acceptance:** board/dialog/book exact shapes render in CEF; publication
  rejects broken NPC/dialog/quest references as one candidate.
- **Status:** `queued`

### QST-02 — Quest state, goals and scripts

- **ID:** `QST-02`
- **depends_on:** `QST-01`, `INV-04`
- **Behavior evidence:** legacy `QUESTS.md`, `QUEST_DIALOG.md`,
  curated fixtures, quest runtime and [QUESTS.md](../modules/QUESTS.md).
- **Content set:** typed quest/step/goal/script definitions for the curated
  chain.
- **Architecture checkpoint / decision:** pending — define persistent progress
  aggregate, script operation registry and idempotent transition transaction.
- **Acceptance:** talk/kill/loot/buy/equip/deliver/area goals and supported
  scripts persist cursor/progress/waiting without duplicate consume/reward.
- **Status:** `queued`

### IUS-01 — Quest item USE and dialog actions

- **ID:** `IUS-01`
- **depends_on:** `QST-02`, `INV-04`
- **Behavior evidence:** legacy `INVENTORY_USE.md`, `ITEM_NPC_DIALOG.md`,
  `artifact_use.json` and [INVENTORY.md](../modules/INVENTORY.md).
- **Content set:** only item scripts, bonus/action definitions and
  dialog-opening references used by the approved 1–8 quests.
- **Architecture checkpoint / decision:** pending — define typed script
  operation registry and one orchestration transaction across quest,
  inventory and character ports.
- **Acceptance:** supported quest-item actions validate requirements,
  consume/grant exactly once and open the exact NPC dialog or plaque; missing
  operation/reference fails publication or returns `203 + error`.
- **Status:** `queued`

### QST-03 — Quest world and combat integration

- **ID:** `QST-03`
- **depends_on:** `QST-02`, `IUS-01`, `CMB-04`, `CHT-01`
- **Behavior evidence:** legacy `QUEST_DIALOG.md`, `QUEST_MAP_MARKERS.md`,
  `QUEST_MACROS_CHAT.md`, known-bug list and
  [QUESTS.md](../modules/QUESTS.md).
- **Content set:** quest bots, AREA actions, fight scripts, markers and system
  message templates required by levels 1–8.
- **Architecture checkpoint / decision:** pending — define orchestration
  transaction and post-commit notifications across quest, world, inventory and
  combat ports.
- **Acceptance:** AREA waiting starts the correct quest fight; only confirmed
  win advances; loss/reset, loot limits, markers and messages follow the
  adapted contract.
- **Status:** `queued`

### QST-04 — Markers and known quest regressions

- **ID:** `QST-04`
- **depends_on:** `QST-03`
- **Behavior evidence:** legacy `QUEST_MAP_MARKERS.md`,
  `TEMP_QUEST_ITEM_AND_MARKER_BUGS.md` and quest QA.
- **Content set:** marker/offer metadata and explicit quest-loot limits for the
  approved core set.
- **Architecture checkpoint / decision:** pending — convert each still-relevant
  legacy defect into one acceptance regression; obsolete defects are removed
  with evidence, not silently ignored.
- **Acceptance:** offer/target markers and quest-loot limit/re-loot behavior
  match the adapted contract without false map markers.
- **Status:** `queued`

## Wave 5 — authored story delivery and core gate

Each quest is an independent CEF milestone. The approved active core set is
defined by the DATA-06 manifest; merely finding `q_1`…`q_14` files does not put
all of them into the core release.

### STORY-01 — q_1 «Рождение скорпиона»

- **ID:** `STORY-01`
- **depends_on:** `QST-04`
- **Behavior evidence:** curated `q_1`, related NPC/dialog/fight evidence.
- **Content set:** q_1 and its complete transitive item/bot/NPC/area/reward refs.
- **Architecture checkpoint / decision:** pending — verify all references close
  inside the active candidate; no story-specific runtime branch.
- **Acceptance:** fresh hero completes talk, kill, ritual fight and turn-in;
  reward/reputation/progress survive restart.
- **Status:** `queued`

### STORY-02 — q_4 «Первое задание скорпиона»

- **ID:** `STORY-02`
- **depends_on:** `STORY-01`
- **Behavior evidence:** curated `q_4` and related hunt evidence.
- **Content set:** q_4 and its complete transitive references.
- **Architecture checkpoint / decision:** pending — no new engine primitive may
  be hidden in story content; missing primitive returns to `QST-*`.
- **Acceptance:** sequential hunt kills advance and turn-in grants exactly one
  set of rewards.
- **Status:** `queued`

### STORY-03 — q_5 «Защита для Скорпиона»

- **ID:** `STORY-03`
- **depends_on:** `STORY-02`, `ECO-01`, `INV-01`
- **Behavior evidence:** curated `q_5`, store 504 and equip-goal evidence.
- **Content set:** q_5, required store lots and equipment references.
- **Architecture checkpoint / decision:** pending — confirm buy/equip signals
  cross module ports after committed mutations.
- **Acceptance:** client buys and equips all required items, then turns in q_5;
  retry cannot duplicate goal credit or rewards.
- **Status:** `queued`

### STORY-04 — q_6 «Щегольские сапоги»

- **ID:** `STORY-04`
- **depends_on:** `STORY-03`
- **Behavior evidence:** curated `q_6`, fight loot and quest-loot evidence.
- **Content set:** q_6, target bots, loot item and limits.
- **Architecture checkpoint / decision:** pending — use QST-04 loot policy
  without quest-specific settlement code.
- **Acceptance:** only confirmed wins grant limited quest loot; turn-in consumes
  the required quantity exactly once.
- **Status:** `queued`

### STORY-05 — q_7 «Лесной изгнанник»

- **ID:** `STORY-05`
- **depends_on:** `STORY-04`
- **Behavior evidence:** curated `q_7`, multi-NPC/world facts and deliver flow.
- **Content set:** q_7 and complete NPC/area/fact/item references.
- **Architecture checkpoint / decision:** pending — confirm world facts and
  quest progress ownership through public ports.
- **Acceptance:** talk, travel, loot and deliver sequence completes in CEF and
  persists at each restart checkpoint.
- **Status:** `queued`

### STORY-06 — q_8/q_9 and level-8 progression band

- **ID:** `STORY-06`
- **depends_on:** `STORY-05`, `CHR-01`, `CMB-03`
- **Behavior evidence:** curated `q_8`, `q_9` and level 1–8 progression evidence.
- **Content set:** approved q_8/q_9 references and enough authored hunt/loot
  content to reach level 8 without manual grants.
- **Architecture checkpoint / decision:** pending — confirm the progression
  band uses general quest/combat rules, not test-only reward inflation.
- **Acceptance:** a normal client path reaches level 8 with persisted
  progression and no manual DB patch.
- **Status:** `queued`

### CORE-GATE — complete cycle 1–8

- **ID:** `CORE-GATE`
- **depends_on:** `STORY-06`
- **Behavior evidence:** all core module contracts and DATA-01…DATA-06
  completeness report.
- **Content set:** one complete, validated core manifest and active release.
- **Architecture checkpoint / decision:** final core audit; unresolved
  architecture work becomes blocking `ARC-*`, never inline cleanup.
- **Acceptance:** clean DB → migrations → import/validate/materialize/activate →
  restart → new hero completes the approved CEF cycle through level 8 without
  runtime legacy access or manual DB patch.
- **Status:** `queued`

After this gate, collapse the pre-baseline migration chain if still desired,
repeat the clean-DB gate and declare the first stable baseline. Applied
migrations are immutable after that declaration.

## Wave 6 — post-core social and economy

### SOC-01 — Chat

- **ID:** `SOC-01`
- **depends_on:** `CORE-GATE`, `RTM-01`, `CHT-01`
- **Behavior evidence:** legacy `CHAT.md`, `chat.ts`, `chatMacros.ts`.
- **Content set:** approved macros/smiles only.
- **Architecture checkpoint / decision:** pending — define chat/outbox module
  boundary and retention policy.
- **Acceptance:** area/private/system messages and required macros reach the
  correct framed channel without exposing session data.
- **Status:** `post-core`

### SOC-02 — Party

- **ID:** `SOC-02`
- **depends_on:** `SOC-01`, `CMB-04`
- **Behavior evidence:** legacy `PARTY.md`, `FIGHT_JOIN.md`, party runtime.
- **Content set:** party UI/config documents, if required.
- **Architecture checkpoint / decision:** pending — decide persistent party
  ownership, membership locking and `4:` channel.
- **Acceptance:** create/invite/accept/kick/leave/disband, leadership, settings
  and party chat remain consistent through reconnect and concurrent membership
  changes.
- **Status:** `post-core`

### SOC-03 — Party bag, grouploot and fight HELP

- **ID:** `SOC-03`
- **depends_on:** `SOC-02`, `CMB-04`
- **Behavior evidence:** legacy `PARTY.md`, `FIGHT_LOOT.md`, `FIGHT_JOIN.md`.
- **Content set:** loot-rule configuration only.
- **Architecture checkpoint / decision:** pending — define party bag TTL,
  inventory transfer and combat join ports without direct cross-table writes.
- **Acceptance:** all supported loot rules, party bag give/drop and same-area
  HELP/JOIN settle once and produce ordered party/personal pushes.
- **Status:** `post-core`

### ECO-02 — Full store catalog and purchases

- **ID:** `ECO-02`
- **depends_on:** `ECO-01`, `CORE-GATE`
- **Behavior evidence:** legacy `STORE.md`, `INVENTORY_USE.md`, store fixtures.
- **Content set:** all validated non-core stores, lots, currencies and gates.
- **Architecture checkpoint / decision:** pending — extend, not bypass, ECO-01
  ports and publication validation.
- **Acceptance:** all 23 manifest-declared store files publish; gold, diamond
  and barter buys plus restrictions pass client scenarios without fixture
  reads.
- **Status:** `post-core`

### ECO-03 — Durability, repair and upgrade

- **ID:** `ECO-03`
- **depends_on:** `ECO-02`, `INV-04`
- **Behavior evidence:** legacy `INVENTORY_USE.md`, `store|repair` and upgrade
  evidence.
- **Content set:** durability, repair-price, upgrade-chain and resonator
  definitions.
- **Architecture checkpoint / decision:** pending — determine whether upgrade
  belongs to inventory with an economy payment port; item replacement must
  preserve explicit identity semantics.
- **Acceptance:** death durability loss, repair and supported six-step upgrade
  chains are atomic, restart-safe and match item/card wire.
- **Status:** `post-core`

### MAIL-01 — Mailbox and plain messages

- **ID:** `MAIL-01`
- **depends_on:** `CORE-GATE`, `INV-02`
- **Behavior evidence:** legacy `MAIL.md` and `src/mail/`.
- **Content set:** mail macros/templates and welcome message policy.
- **Architecture checkpoint / decision:** pending — define mailbox ownership,
  sender/recipient identity and list/send/delete transaction boundary.
- **Acceptance:** inbox/outbox, plain send/delete and welcome letter are
  restart-safe, paginated and preserve exact list/macros wire.
- **Status:** `post-core`

### MAIL-02 — Attachments, COD and expiry

- **ID:** `MAIL-02`
- **depends_on:** `MAIL-01`, `ECO-02`
- **Behavior evidence:** legacy `MAIL.md` attachment/COD/TTL flows.
- **Content set:** TTL and fee policy.
- **Architecture checkpoint / decision:** pending — define item/fund
  reservations, claim/retract locking and expiry worker ownership.
- **Acceptance:** send attachments/gold, COD, pick/batch-pick, retract and
  return-on-expiry have one winner under races and never lose ownership.
- **Status:** `post-core`

### AUC-01 — Auction listings and bids

- **ID:** `AUC-01`
- **depends_on:** `MAIL-02`, `ECO-02`
- **Behavior evidence:** legacy `AUCTION.md` and `src/auction/`.
- **Content set:** auction configuration and fee policy.
- **Architecture checkpoint / decision:** pending — define listing/order holds,
  row locking and mail delivery port.
- **Acceptance:** list/page/my-lot/my-bid, add, bid, buyout, cancel and expiry
  races have one winner and durable mail settlement.
- **Status:** `post-core`

### AUC-02 — Auction tenders

- **ID:** `AUC-02`
- **depends_on:** `AUC-01`
- **Behavior evidence:** legacy `AUCTION.md` tender flows.
- **Content set:** tender fee/limit policy.
- **Architecture checkpoint / decision:** pending — reuse listing holds and
  mail settlement; define partial-fill row locking.
- **Acceptance:** tender create/sell/cancel and concurrent partial fills never
  oversell quantity or duplicate payment/delivery.
- **Status:** `post-core`

### TRD-01 — Direct trade session

- **ID:** `TRD-01`
- **depends_on:** `SOC-01`, `INV-02`
- **Behavior evidence:** legacy `TRADE.md` and `src/trade/`.
- **Content set:** trade fee policy.
- **Architecture checkpoint / decision:** pending — decide session lifetime,
  invite/window delivery and restart behavior.
- **Acceptance:** request/accept/cancel, item/money offers and confirmation-key
  rotation keep one process-local session consistent through disconnect.
- **Status:** `post-core`

### TRD-02 — Direct trade settlement

- **ID:** `TRD-02`
- **depends_on:** `TRD-01`, `ECO-02`
- **Behavior evidence:** legacy `TRADE.md` settlement and tax evidence.
- **Content set:** validated tax policy.
- **Architecture checkpoint / decision:** pending — define item/fund
  reservations and one atomic two-hero settlement transaction.
- **Acceptance:** double confirmation swaps items/money once, charges the
  documented tax and rejects NOGIVE or stale offers without duplication.
- **Status:** `post-core`

## Wave 7 — extended game systems

These entries are ordered only after Wave 6. Moving one to implementation
requires an architecture checkpoint and an explicit queue edit.

### DNG-01 — Instance and dungeon foundation

- **ID:** `DNG-01`
- **depends_on:** `SOC-03`, `CMB-04`, `ECO-02`
- **Behavior evidence:** legacy `DUNGEON.md` and dungeon catalog.
- **Content set:** dungeon definitions, floors, hunts, binds and rewards.
- **Architecture checkpoint / decision:** pending — instance ownership and
  expiration require a dedicated `ARC-*` or ADR decision before coding.
- **Acceptance:** published instance definition can create a copy, bind party
  members, isolate area/hunt state, expire and return members without storing
  active combat in PostgreSQL.
- **Status:** `deferred`

### DNG-02 — «Провал» vertical slice

- **ID:** `DNG-02`
- **depends_on:** `DNG-01`
- **Behavior evidence:** legacy `DUNGEON.md`, `proval.json`, coin shop 724.
- **Content set:** full manifest for areas 548–551, encounters, clear
  checkpoints, bosses, loot and coin shop.
- **Architecture checkpoint / decision:** pending — reuse DNG-01 contracts;
  dungeon-specific behavior remains authored policy.
- **Acceptance:** a party enters, clears all floors, receives personal boss
  loot/coins, exits and spends coins after reconnect.
- **Status:** `deferred`

### DNG-03 — Remaining legacy dungeons

- **ID:** `DNG-03`
- **depends_on:** `DNG-02`
- **Behavior evidence:** the other seven manifest-declared dungeon files and
  legacy dungeon tests.
- **Content set:** one validated release entry set per dungeon.
- **Architecture checkpoint / decision:** pending — split into one capability
  per dungeon if any introduces a new engine primitive.
- **Acceptance:** every published dungeon completes its authored
  enter/floor/clear/boss/loot/exit scenario without runtime JSON reads.
- **Status:** `deferred`

### PRF-01 — Profession content and hero state

- **ID:** `PRF-01`
- **depends_on:** `CORE-GATE`, `WLD-02`, `INV-02`
- **Behavior evidence:** legacy profession, fixture and quest-grant evidence.
- **Content set:** professions, resource types, assistants, recipes, farms and
  level/mastery policies.
- **Architecture checkpoint / decision:** pending — define module ownership,
  scheduler clock and quest/inventory/world ports.
- **Acceptance:** complete enabled profession catalog publishes and a quest
  grant persists the correct profession pair and bootstrap state.
- **Status:** `deferred`

### PRF-02 — Assistants and gathering

- **ID:** `PRF-02`
- **depends_on:** `PRF-01`, `CHT-01`
- **Behavior evidence:** legacy assistant work/repeat/revoke/save/create/upgrade
  flows.
- **Content set:** assistant chains, resource nodes, durations and rewards.
- **Architecture checkpoint / decision:** pending — define durable jobs and
  bounded expiry processing without request-time fallback.
- **Acceptance:** deploy, finish, claim/repeat/revoke and upgrade survive
  restart and atomically grant inventory/mastery/stat changes.
- **Status:** `deferred`

### PRF-03 — Crafting

- **ID:** `PRF-03`
- **depends_on:** `PRF-02`
- **Behavior evidence:** legacy craft recipes, cooldown and favorites.
- **Content set:** complete enabled recipes, ingredients, outputs and XP bands.
- **Architecture checkpoint / decision:** pending — define ingredient consume,
  result grant and cooldown transaction.
- **Acceptance:** craft and favorites produce one output/XP result after the
  authored cooldown and remain consistent after retry/restart.
- **Status:** `deferred`

### BG-01 — «Раскоп» queue and match

- **ID:** `BG-01`
- **depends_on:** `SOC-02`, `CMB-04`
- **Behavior evidence:** legacy `BATTLEGROUNDS.md`, `HEROISM.md`, `src/bg/`.
- **Content set:** Раскоп queue, areas 635–637, maps, score and reward
  definitions.
- **Architecture checkpoint / decision:** pending — matchmaking, instance and
  PvP settlement require a dedicated decision.
- **Acceptance:** two eligible heroes queue/confirm, enter an isolated match,
  fight to score/timeout, receive ordered finish packets and persist history;
  restart clears only ephemeral queue/match state.
- **Status:** `deferred`

### BOOK-01 — Bestiary and instance books

- **ID:** `BOOK-01`
- **depends_on:** `DNG-02`, `CMB-03`
- **Behavior evidence:** legacy `BESTIARY.md`, `DUNGEON.md`, book handlers.
- **Content set:** bestiary presentation and instance catalog references.
- **Architecture checkpoint / decision:** pending — define read models over
  combat kills and instance binds without copying mutable state.
- **Acceptance:** bestiary kill counters and active/completed instance entries
  match persisted outcomes in exact book wire.
- **Status:** `deferred`

### INFO-01 — HTML information pages

- **ID:** `INFO-01`
- **depends_on:** `BOOK-01`
- **Behavior evidence:** legacy `INFO_PAGES.md` and HTML fixtures.
- **Content set:** page presentation references; no clan/pet/companion fake
  catalogs.
- **Architecture checkpoint / decision:** pending — define typed read models
  for user/artifact/fight/bot pages.
- **Acceptance:** supported popups render live persisted/catalog data and
  return explicit unsupported responses for excluded page types.
- **Status:** `deferred`

## Wave 8 — optional overlays and authoring

### GEAR-01 — Equipped gear spells

- **ID:** `GEAR-01`
- **depends_on:** `CMB-04`, `ECO-03`
- **Behavior evidence:** legacy `GEAR_SPELL.md` and spell catalogs.
- **Content set:** validated equipment spell definitions and effect refs.
- **Architecture checkpoint / decision:** pending — extend the combat-ready
  equipment snapshot and effect registry without changing inventory ownership.
- **Acceptance:** supported equipped spell attaches/procs with exact packet
  order and expires by authored policy.
- **Status:** `deferred`

### HERO-01 — PvP heroism

- **ID:** `HERO-01`
- **depends_on:** `BG-01`, `CHR-01`
- **Behavior evidence:** legacy `HEROISM.md`; empirical formula remains labeled
  `legacy behavior`.
- **Content set:** heroism bands/modifiers and presentation.
- **Architecture checkpoint / decision:** pending — define PvP settlement and
  character progression ownership.
- **Acceptance:** fixed-seed PvP outcomes grant the documented amount once and
  render it in BG/fight/player stats wire.
- **Status:** `deferred`

### DAY-01 — Daily quests

- **ID:** `DAY-01`
- **depends_on:** `QST-04`
- **Behavior evidence:** legacy `DAILY_QUESTS.md`.
- **Content set:** explicitly approved daily quest definitions and reset
  policies.
- **Architecture checkpoint / decision:** pending — define timezone, scheduler,
  idempotency and downtime catch-up before coding.
- **Acceptance:** offer/finish/cooldown/reset survive restart and cannot grant a
  second reward inside one daily period.
- **Status:** `deferred`

### ACH-01 — Achievements

- **ID:** `ACH-01`
- **depends_on:** `GEAR-01`, `HERO-01`, `DAY-01`
- **Behavior evidence:** legacy `ACHIEVEMENTS.md` is currently incomplete/stub
  evidence and does not authorize implementation by itself.
- **Content set:** none until a separately approved achievement catalog and
  client contract exist.
- **Architecture checkpoint / decision:** blocking product/evidence decision
  required; do not convert legacy empty success into a feature.
- **Acceptance:** must be specified from stronger evidence before this item can
  leave `deferred`.
- **Status:** `deferred`

### EDT-01 — Core content editor

- **ID:** `EDT-01`
- **depends_on:** `CORE-GATE`
- **Behavior evidence:** legacy content UI is UX evidence only;
  [CONTENT_PIPELINE.md](../architecture/CONTENT_PIPELINE.md) is authoritative.
- **Content set:** DATA-01…DATA-06 authoring schemas.
- **Architecture checkpoint / decision:** define operator auth, optimistic
  draft versioning, validation report and publish/activate ports; filesystem
  dual-write remains forbidden.
- **Acceptance:** edit creates a new PostgreSQL draft, failed validation leaves
  active release unchanged, successful publish activates atomically and
  survives server restart.
- **Status:** `deferred`

### EDT-02 — Extended content editor

- **ID:** `EDT-02`
- **depends_on:** `EDT-01`, `DNG-03`, `PRF-03`, `BG-01`
- **Behavior evidence:** corresponding legacy editor screens and completed
  module contracts.
- **Content set:** stores, dungeons, professions, BG, spell and item-use
  authoring schemas already proven by runtime.
- **Architecture checkpoint / decision:** extend the same draft/release ports;
  editor may not introduce a second source of truth.
- **Acceptance:** every supported extended content type follows
  draft→validate→publish→activate with no file mutation.
- **Status:** `deferred`

## Excluded

### EXC-01 — Clan and in-process playerbots

- **ID:** `EXC-01`
- **depends_on:** —
- **Behavior evidence:** scope boundary in
  [SOURCE_BOUNDARY.md](SOURCE_BOUNDARY.md).
- **Content set:** none.
- **Architecture checkpoint / decision:** fixed boundary; playerbots, if ever
  approved, are a separate service.
- **Acceptance:** no clan or in-process playerbot runtime/content enters a
  migration capability.
- **Status:** `excluded`
