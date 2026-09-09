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
- Ровно одна запись имеет статус `next`: **REP-01**.
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
  resolved from the resulting boundary and remains 2 throughout L1–L8; bag
  `amount`/`total`/`amount_max` belong to `INV-02`. Travel overload gate stays
  `WLD-01`. CHR-01 adds no fake OA: until
  CMB-03 or a quest flow consumes the port, character progression remains
  product-status `partial` and has no independent CEF gate.
- **Status:** `done`

### CHR-02 — out-of-combat HP regeneration

- **ID:** `CHR-02`
- **depends_on:** `CHR-01`
- **Behavior evidence:** legacy `HP_REGEN.md`, `src/regen.ts` and
  [CHARACTER.md](../modules/CHARACTER.md).
- **Content set:** existing published `HPREG` skill; `RegenPolicy.k=250` in
  game policy with provenance `legacy behavior / empirical`. Runtime
  `hp`/`hp_time`/`regen_at` are player state, not content. `MPREG` / mana
  regen is a documented research gap: `mp_time` stays the HUD default `0`.
- **Architecture checkpoint / decision:** complete — existing ADRs and the
  hero aggregate are sufficient; no `ARC-CHAR`. Character owns lazy HP regen
  under the hero row lock; a shared injected `Clock` is authoritative;
  combat supplies a read-only active-fight query so character does not import
  fight RAM. Ghost/injury/RESURRECT are CMB-04. Full contract:
  [CHARACTER.md](../modules/CHARACTER.md).
- **Acceptance:** wounded HP regenerates from persisted `regen_at` on
  resource reads and mutations; `hp_time` is remaining seconds from
  `max(1, round(deficit * 250 / HPREG))` while deficit > 0; full HP and
  active fight yield `hp_time=0` without writing `hp_time` or `regen_at`; missing or
  non-positive `HPREG` while wounded and clock regression fail without
  mutation. ATTACK_BOT syncs before `startHunt`. Reconnect/restart and a
  fake clock (same instance across harness restart) are required. No
  per-hero ticker, no invented MP formula, no fake OA, no CEF gate until
  combat persists HP.
- **Status:** `done`

### INV-02 — Bag rules and DROP

- **ID:** `INV-02`
- **depends_on:** `CHR-01`
- **Behavior evidence:** legacy `TRAVEL_BAG.md`, `items.ts`, `bagWeight.ts`,
  `routes/oa/commonObject.ts` and [INVENTORY.md](../modules/INVENTORY.md).
- **Content set:** bump `playable-slice/v5` → `v6`. Artifact 9095 gains
  `priceMinor: 0`, `flags: 40`, `bagStack: 1` from live dump
  `_research/from_register/interesting_full.json`. No second artifact unless
  dump-proven L1–8 stackable/sellable is found; otherwise stop and replan.
  Capacity base 20 stays in `GamePolicy`, not a hero column.
- **Architecture checkpoint / decision:** complete — existing ADRs and
  `ARC-ECO` are sufficient; no `ARC-INV`. Inventory owns items; character owns
  `money_minor` and `creditMoney` in the same UoW; catalog supplies
  price/flags/bagStack from the pinned release. Wire OA is always `code=DROP`
  (SELL is a registered thin alias). Full contract:
  [INVENTORY.md](../modules/INVENTORY.md).
- **Acceptance:** DROP throw-away of 9095 removes the instance, leaves money
  `"25.00"`, and returns the flat DROP block set (`common|action`, `user|bag`,
  `user|skills`, `user|mount_list`, `state`). Bag `amount` counts weighted rows
  only (`9095` → `amount=0`, `total=1`); `amount_max=20`. Equipped DROP and
  missing item are `204` with the live Russian `error`. Concurrent DROP neither
  duplicates nor loses the row. Reconnect/restart and CEF throw-away from bag
  are required. Overload travel gate stays `WLD-01`. No invented loot IDs, no
  fake OA besides DROP/SELL.
- **Status:** `done`

### INV-03 — Pocket mutations and quick access

- **ID:** `INV-03`
- **depends_on:** `INV-02`
- **Behavior evidence:** legacy `POCKET.md` (world layout, not fight cast),
  `ARCHITECTURE.md` pocket rules, `items.ts` `putOnPocket`/`putOff`,
  `pocketLayout.ts` and [INVENTORY.md](../modules/INVENTORY.md).
- **Content set:** bump `playable-slice/v6` → `v7`. Publish dump-proven
  pocketables **93** (Малый эликсир жизни) and **99** (Малый усиливающий орб)
  from `_research/from_register/interesting_full.json` +
  `jgr-emu/docs/CHARACTER_STATS.md`. Starter: both in **bag**, empty pocket
  (live belt is not copied). Weight 100/10 from `ARCHITECTURE.md` pocket
  `floor(100/weight)`. No 209, no bandolier, no spell blob.
- **Architecture checkpoint / decision:** complete — existing ADRs sufficient;
  no `ARC-INV`. Same `PUT_ON`/`PUT_OFF` OA; pocket is `location_kind=pocket`
  - unique `(hero_id, pocket_position)`. Combat does not consume a snapshot
    yet; `listPocket` is a read port for CMB-02. Fight cast/USE/`persSpells`
    stay `INV-04`/`CMB-02`. Full contract:
    [INVENTORY.md](../modules/INVENTORY.md).
- **Acceptance:** bag→empty slot, bag→merge/split, pocket→pocket merge/swap,
  PUT_OFF to bag, unique slot occupancy, `user|pocket` array + `capacity=4`
  survive reconnect/restart. Pocket deny is `204` with live Russian `error`.
  Paperdoll 9095 cannot enter pocket. DROP from pocket remains `204`. CEF:
  drag elixir 93 onto the belt, reconnect, PUT_OFF. No fight cast.
  PUT_ON/PUT_OFF/DROP/SELL in fight are `FightRules` `203` (named j-emu lock,
  not live parity; pocket spend stays `CMB-02`).
- **Status:** `done`

### INV-04 — Core consumable USE

- **ID:** `INV-04`
- **depends_on:** `INV-02`, `INV-03`
- **Behavior evidence:** legacy `INVENTORY_USE.md`, `bonuses.ts` and
  [INVENTORY.md](../modules/INVENTORY.md).
- **Content set:** bump `playable-slice/v7` → **v8**. Publish dump-proven
  food **77** (Кусок мяса) from `_research/from_register/interesting_full.json`
  / `jgr-emu/fixtures/common_init_slim.json`. Typed `artifact_actions` ADD_HP
  only. No ADD_MP, DRINK, books, `bonus_id` pipelines, 93/99 spell blobs.
  Starter: **77×4** in bag (dump `cnt`).
- **Architecture checkpoint / decision:** complete — existing ADRs sufficient;
  no `ARC-INV`. World USE is bag-only `common|object` with
  `object_class=ARTIFACT` and **no** `code`; inventory consumes; character
  `noteHp` in the same UoW after `syncResources`. Unknown action codes are
  `203`, not empty `100`. Fight layout lock already covers USE (live
  `fightBusy`). Pocket fight cast stays `CMB-02`; quest scripts stay `IUS-01`.
  Full contract: [INVENTORY.md](../modules/INVENTORY.md).
- **Acceptance:** wounded hero USE 77 heals `max(1, floor(hpMax*30/100))`,
  clamps to hpMax, consumes 1, returns flat USE blocks; full-HP USE still
  consumes; in-fight USE `203`; 9095/93/99 USE `203` no action; reconnect.
  CEF: eat meat from bag, stack drops. No fake OA.
- **Status:** `done`

## Wave 2 — world, hunt and realtime

### WLD-01 — Area transitions

- **ID:** `WLD-01`
- **depends_on:** `INV-02`
- **Behavior evidence:** legacy `TRAVEL_BAG.md`, `AREA_SIDEBAR.md`,
  `travel.ts`, `areaActions.ts`, `commonObject.ts` COME_IN, `common.ts` exit
  and [WORLD.md](../modules/WORLD.md).
- **Content set:** `playable-slice/v10` dump-proven **503 ↔ 504** (store interior)
  and **503 ↔ 501** (outdoor `ftime_max=15`). Authored travel `area_links` only
  (503 items 5 and 7, 501 item 2, 504 item 0). No 498/502/542, no NPC/AREA-attack
  sidebar rows, no store lots. Full L1–8 atlas stays DATA-04.
- **Architecture checkpoint / decision:** complete — existing ADRs sufficient;
  no `ARC-WORLD`. Location stays `heroes.area_id`; add `heroes.move_ready_at`
  (NULL = free). World owns `areas` + `area_links` + `areas.parent_id`; no
  `character_locations`. OA orchestrates world `requireLink` / `linksFrom`,
  inventory `bagLoad`, character `setArea`, combat `FightRules`. SPEED=0 in
  slice; `ftime = floor(ftime_max × (100 − SPEED) / 100)`. Exit from
  `code=store` does not set the lock. Store buy stays ECO-01; presence RTM-01;
  hunt locks WLD-02. Full contract: [WORLD.md](../modules/WORLD.md).
- **Acceptance:** COME_IN 503→504 and `common|exit`→503; COME_IN 503→501 with
  15s lock then return; wait 204 with live `&nbsp;` error; overload
  `amount > amountMax` 204 (20/20 walks); missing link 203 `некуда идти`;
  outdoor exit 204; fight 203; dest `area_conf.items` + hunt + reconnect.
  CEF: shop and gorge from 503 sidebar. No fake OA.
- **Status:** `done`

### RTM-01 — Personal and area realtime

- **ID:** `RTM-01`
- **depends_on:** `WLD-01`
- **Behavior evidence:** legacy `SYNC.md` phases 0–2 (roster only), `CHAT.md`
  `area_population`, `presence.ts`, `esrvOutbox.ts`, `routes/esrv.ts`,
  [WIRE_INVARIANTS.md](WIRE_INVARIANTS.md) and [WORLD.md](../modules/WORLD.md).
- **Content set:** none; roster is runtime (`identity.sessions` +
  `heroes.area_id`). Hunt snapshot on `131:` uses already published spawns.
- **Architecture checkpoint / decision:** complete — existing ADRs sufficient;
  no `ARC-RTM`. Roster is durable Postgres (sessions ⨝ area_id). Delivery
  queue is process-local (lost on restart; init2 rebuilds). No transactional
  outbox table. `jugger-wire` owns MULTI/`2:`/`131:`/chat-auth; world owns
  presence notify ports. Per-account long-poll wake is in-capability
  jugger-wire refactor. Ghost/injury `change`, hunt wander, `chat|add`,
  party `4:` stay out. Full contract: [WORLD.md](../modules/WORLD.md).
- **Acceptance:** two isolated heroes in 503 see each other in
  `chat|area_population`; B's esrv gets `2:` `area_population_diff` add/remove
  when A enters/leaves/COME_IN; `131:<area>` hunt snapshot on poll; chat auth
  empty body; restart rebuilds roster from sessions. No playerbots.
- **Status:** `done`

### WLD-02 — Hunt spawn lifecycle and locks

- **ID:** `WLD-02`
- **depends_on:** `WLD-01`, `RTM-01`
- **Behavior evidence:** `lifecycle.ts` ATTACK_BOT / `interveneJoin`,
  [FIGHT_JOIN.md](../../../jgr-emu/docs/FIGHT_JOIN.md) «Intervene с карты»,
  `huntLocks.ts`, hunt wire in `FIXTURES.md`, and
  [WORLD.md](../modules/WORLD.md). `SYNC.md` phase 3 («второй ATTACK → 203»)
  weaker than the live path: occupied spawn joins team 1.
- **Content set:** existing `playable-slice/v10` spawn **50310** (Gryzl artikul 2)
  only. Dump `hunt_spawns.json` 50310 has **no** `zone`/`route` /
  `respawn_time_*` — do not invent them, do not publish 50311–13 or Hissa 4.
- **Architecture checkpoint / decision:** complete — existing ADRs sufficient;
  no `ARC-*`. Overlay is process-local in world. Occupied ATTACK_BOT is
  `joinHunt` team 1 on the existing RAM `Battle` (same `fightId`/`akey`,
  joiner `userId` = `heroes.id`). FIGHT_JOIN / FIGHT_HELP OA stay out.
  Shuffle 3↔3 stays out. Full contract: [WORLD.md](../modules/WORLD.md).
- **Acceptance:** A ATTACK_BOT 50310 occupies the spawn; B same `bot_id` gets
  `100` + `fight|conf` with **same** `fightId`/`fightAkey` and **B’s**
  `userId`; hunt `fight_id` unchanged; A fproxy sees B on roster; B bootstrap
  is wait (`oppwait`) if A already holds the bot. Deny already-in-fight /
  other area / finished fight with `203` + `error`. Stale overlay (no RAM
  battle) releases and starts a new hunt. Finish/restart still idle `0`. No
  wander. Do not map `2`→`50310`.
- **Status:** `done`

## Wave 3 — complete core combat

### CMB-01 — Turn loop and melee ordering

- **ID:** `CMB-01`
- **depends_on:** `WLD-02`, `CHR-02`
- **Behavior evidence:** `FIGHT_TURN_UI.md`, `FIGHT_CAST_ACK.md` melee row,
  `turns.ts` grant delay, `dispatch.ts` `cast_ignored_not_your_turn`,
  `actions/melee.ts` kill `attackwait`, `delivery.ts` standalone `attacknow`,
  and [COMBAT.md](../modules/COMBAT.md). `FIGHT_DAMAGE.md` formulas are
  empirical — keep current `BattleRules` ranges labeled `legacy behavior`.
- **Content set:** existing `playable-slice/v10` bot **2** / spawn **50310**
  fight look and `BattleRules`. No new catalog rows, no bot spell book.
- **Architecture checkpoint / decision:** complete — existing ADRs sufficient;
  no `ARC-*`. Active fight stays RAM (ADR-0020). Do not add `schedule` to
  shared `Clock`. Combat owns an injected process-local delay port (dueAt +
  cancel by fight token); domain `Battle` stays synchronous. Outbound packets
  stay per-account queues. Melee `srcType:1` `srcId` 1/2/3 = L/C/R. Strike →
  `{rs,sq}` in one poll; bot counter and next `attacknow` are later polls.
  `FIGHT_TURN_GRANT_DELAY_MS` default 2500; bot counter delay from live melee
  pacing (~1400), not AOE. Off-turn / waiter melee: empty HTTP + poll `{rs:true}`
  no strike. Kill: clear grant **before** resolve. Waiter re-pair only if the
  paired hunter dies and the bot still lives — not 3↔3 shuffle. Pocket/glove/
  rage stay CMB-02. Full contract: [COMBAT.md](../modules/COMBAT.md).
- **Acceptance:** raw-AMF 1v1: L/C/R `castSpell` empty HTTP; poll is
  `attackwait`+`cast` then `{rs,sq}` (no `attacknow` in that MULTI); later bot
  `cast`; later standalone `attacknow`. FakeClock/delay fires grants without
  wall-clock sleep. Off-turn melee `{rs:true}` no HP change. Kill poll has
  leading `attackwait` and no leftover `attacknow`. Two heroes: waiter stays
  `oppwait` during A's loop; if A dies and bot lives, B gets `oppnew` then
  `attacknow`. CEF: L/C/R appear after pause, hide during own strike, bot
  does not clip the animation. No pocket/glove.
- **Status:** `done`

### CMB-02 — Pocket, glove, rage and aggro

- **ID:** `CMB-02`
- **depends_on:** `CMB-01`, `INV-03`
- **Behavior evidence:** `POCKET.md`, `GLOVE_MAGIC.md` (9095), `FIGHT_RAGE.md`,
  `FIGHT_CAST_ACK.md` rs-before-strike rows, `FIGHT_TOASTS.md` restriction 18
  only if a slice spell is kind 11, and [COMBAT.md](../modules/COMBAT.md).
- **Content set:** dump-proven fight `spell` on existing **93** and **99**;
  **9095** `extra.spells` sockets with live `artikul_id0` **9098 / 9100 / 9099**
  and those three spell artifacts. No titan/cartridge/orb families, no 77 in
  fproxy, no backstab `srcId:5`, no kind 11 unless the dump for these ids has
  it. Spell numbers labeled `legacy behavior` if `FIGHT_DAMAGE`/`FIGHT_RAGE`
  formulas are empirical.
- **Architecture checkpoint / decision:** complete — existing ADRs sufficient;
  no `ARC-*`. Combat stays RAM (ADR-0020). `startHunt`/`joinHunt` take an
  immutable combat loadout from inventory+catalog ports (pocket rows + equipped
  glove or empty). Combat does not import inventory repositories. Fproxy
  command orchestrates: decode → combat cast → inventory `consume` on pocket
  success. `{rs,sq}` **before** strike for `srcType` 2/3 and native 6/7.
  Melee L/C/R stay strike-then-rs. Kind 11 without target: HTTP
  `{rs:false, restriction:18}` — only if a published slice spell is kind 11.
  Pocket CD deny: HTTP `{rs:false}` no restriction. Glove `cp − cost`, not
  reset. Native 6/7 already in hunt `persSpells`; make them executable. No
  `Clock.schedule`. Full contract: [COMBAT.md](../modules/COMBAT.md).
- **Acceptance:** raw-AMF ordered frames: elixir 93 and orb 99 never
  double-spend; 99 `cast` `ev:[]`; rage 6 / aggro 7 rs-then-FX and aggro never
  −1; glove 9095 combo `persCP` then finisher rs-then-strike; off-turn ending
  glove `{rs:true}` + absolute `persCP`. CEF: belt/glove/rage/aggro counters
  match one server consume. Melee loop from CMB-01 still holds.
- **Status:** `done`

### CMB-03 — Terminal settlement and loot

- **ID:** `CMB-03`
- **depends_on:** `CMB-01`, `CMB-02`, `CHR-01`, `CHR-02`, `RTM-01`
- **Behavior evidence:** `FIGHT_LOOT.md`, `FIGHT_MODEL.md`, `CHARACTER_STATS.md`,
  `POCKET.md` refill, `dispatch.ts` `leaveFight`, `loot.ts`/`lootNotify.ts`
  `fight|loot` shape, `notify.ts` flee `fight|exit`, and
  [COMBAT.md](../modules/COMBAT.md).
- **Content set:** Gryzl bot **2** overlay rewards only: `base_exp` 15,
  `money_min`/`money_max` 0.2/0.44 gold coins, loot `drop_cnt` 1,
  `bonus_chance` 0.2, `bonus_min`/`bonus_max` 1. Published drop entries whose
  artifacts already exist in DATA-01: **77**, **93**, **99** with overlay
  `drop_weight`/`count_min`/`count_max`. Overlay `nothing_weight` 3000 **plus**
  the sum of overlay entry weights whose artikul is not in the published
  slice (unpublished ids contribute to NOTHING, not a substitute item).
  Provenance: `legacy emu overlay / FIGHT_LOOT invented live rates`. No
  56–63/78/… artifacts, no quest/`kind:loot`, no dungeon bands, no honor.
- **Architecture checkpoint / decision:** complete — existing ADRs sufficient;
  no `ARC-*`. Active combat stays RAM (ADR-0020). Composition owns one
  Unit of Work after RAM finish: character `noteHp` or `noteDefeat` (HP 0) +
  `grantExperience` (skip when amount would be `< 1`) + `creditMoney`; inventory
  bag grants + `refillPocketAfterFight` from the fight-start pocket snapshot. Combat does
  not write `heroes`/`items`. Catalog owns authored bot reward scalars and
  `bot_loot_entries`. RNG is injected `RandomSource`, not `Math.random`.
  Idempotency key `fight:{fightId}:{characterId}` on EXP. Durable writes
  commit **before** esrv packets; `finished_fights` remains best-effort and
  must not roll back rewards. Same personal `2:` object: `fight|loot` then
  `fight|exit` (empty loot is `[]` not `{}`). System `chat|add` is post-core.
  Ghost/injury/RESURRECT are CMB-04; loss may persist HP `0`. Restart still
  abandons RAM without settlement. Full contract:
  [COMBAT.md](../modules/COMBAT.md).
- **Acceptance:** raw-AMF 1v1 50310 win: HP/EXP/money/loot persist across
  reconnect/restart; esrv one `2:` packet loot-then-exit; pocket cells spent
  in the fight refill from bag. Loss: `noteDefeat`, refill, exit without item
  loot/EXP. `leaveFight`: HTTP `{rs:true}` then `fight|exit`
  `{flee:true,type:2}`; last human ends the battle. Duplicate settlement is
  a no-op. FakeClock/RNG, no wall-clock sleep. CEF: result screen without
  ~60s ResultWaiting; bag/EXP/HP match server after exit. Two-hunter join
  still one fight id; loot to top damager, EXP by damage share.
- **Status:** `done`

### CMB-04 — Reconnect, locks and history

- **ID:** `CMB-04`
- **depends_on:** `CMB-03`
- **Behavior evidence:** `FIGHT_RECONNECT.md`, `FIGHT_LOCK.md`, `FIGHT_JOIN.md`
  (reconnect is init2 `fight|conf`, not OA JOIN), `HP_REGEN.md` ghost,
  `presence.ts` `dead:4`, `commonObject.ts` `RESURRECT`, ADR-0020 and
  [COMBAT.md](../modules/COMBAT.md).
- **Content set:** none beyond already published fight definitions.
- **Architecture checkpoint / decision:** complete — existing ADRs sufficient;
  no `ARC-*`. Active fight stays RAM (ADR-0020); no reconnect table.
  `common|init2` piggybacks `fight|conf` while `CombatPort.activeFightId` is
  set; overlay `state`/`unitframe` `fight_id` from that port (not HUD
  default). Re-auth parks bootstrap; if still paired, skip `oppwait` and
  send `oppnew` + `attacknow` with remaining `restTime`. Turn wall-clock
  does not pause. Restart still drops RAM without settlement (existing
  `combat-restart`). `FinishedFightCleanup` already owns 72h batches —
  do not add request-path cleanup or `arena|finished_fights` OA.
  Ghost/injury belong to character (`heroes.ghost`, `injury_time`,
  `injury_artikul_id`); combat does not write those columns. Loss
  settlement calls a character port from the same composition UoW as
  `noteDefeat`. Ghost blocks CHR-02 regen. Roster `dead:4` when ghost
  (live presence). `RESURRECT` is existing `common|object` code: HP
  `max(2, floor(hpMax*0.05))`, clear ghost/injury, outdoor dest stays
  current area 503 (no dungeon/BG). Injury id **875** is a dump-proven
  wire integer; do not publish artifact 875. OA `FIGHT_JOIN`/`HELP` stay
  out. Full contract: [COMBAT.md](../modules/COMBAT.md).
- **Acceptance:** raw-AMF F5 mid-hunt: init2 has same `fightId`/`akey`,
  arena re-auths, paired hunter sees opponent and remaining turn bar
  (not `oppwait`). Restart mid-fight still no rewards/history. Loss:
  ghost persists, hp stays 0 across clock advance, roster `dead:4`;
  RESURRECT clears ghost, HP > 0, FightRules unlock. CEF: F5 in Gryzl
  fight returns to arena; death shows ghost until RESURRECT.
- **Status:** `done`

## Wave 4 — quest dependencies and cycle 1–8

### ECO-01 — Quest-required stores

- **ID:** `ECO-01`
- **depends_on:** `WLD-01`, `INV-02`, `CMB-04`
- **Behavior evidence:** `STORE.md`, `src/store.ts`, `_research/samples/STORE.md`,
  `fixtures/stores/504.json`, curated `q_5` (artikuls 23 and 24),
  [EVIDENCE_INDEX.md](EVIDENCE_INDEX.md).
- **Content set:** bump `playable-slice/v12` → **v13**. Dump 504 type
  `-131` and **only** lots artikul **23** (`lot_id` 80) and **24** (`lot_id` 82),
  `price` 1 gold, empty requires. Types `159`/`10`/`21` stay unpublished:
  their lots are ECO-02, and an empty tab hangs CEF on «загрузка данных».
  Publish artifacts 23 and 24 from Pub1 AMF (dump-proven wear fields). Do not
  publish the rest of `504.json` or the 23-file store corpus (ECO-02 / DATA-02).
- **Architecture checkpoint / decision:** complete — existing ADRs sufficient;
  no `ARC-ECO`. Money stays `heroes.money_minor`; add character `debitMoney`
  (positive minor, fail if insufficient, no clamp, no second balance).
  Catalog owns `store_types` / `store_lots`; world already owns area 504
  `code=store`; composition UoW `debitMoney` + `grantToBag`. Inventory does
  not write `heroes`. No economy module, ledger, diamond/artifact barter,
  `store|repair`, OPEN_STORE, RANK/REPUTATION parser, or quest book
  piggyback. `FightRules` does not block `store|*`. Ghost buy is 203.
  List/buy wire and status **2** codes: [STORE.md](../modules/STORE.md).
- **Acceptance:** COME_IN 504 list shows types + lots 23/24; buy both is
  atomic (`25.00` → `23.00`, bag persists reconnect/restart); not-in-store /
  empty basket / unknown lot / insufficient gold → status 2; ghost → 203;
  missing artifact fails publication. CEF: buy glove+наруч in the shop.
- **Status:** `done`

### REP-01 — Quest-required reputation

- **ID:** `REP-01`
- **depends_on:** `CHR-01`
- **Behavior evidence:** `REPUTATION.md`, `src/reputation.ts`,
  `heroLifetime.ts` `user|stats`, `reputation_tracks.json`, curated q_1
  `award.rep` object_id 5, [EVIDENCE_INDEX.md](EVIDENCE_INDEX.md).
- **Content set:** bump after v13 — catalog track **5** only (Радвея, type 2,
  empty unlock). Do not publish SUM 36, other factions, or `reputation_kills`
  (bot 2 has none).
- **Architecture checkpoint / decision:** complete — existing ADRs sufficient;
  no `ARC-CHAR`. Catalog owns authored track; character owns
  `hero_reputations` and `grantReputation`. SUM 36 is derived on read, never
  a grant target. No kill-rep on Gryzl, no `REPUTATION` gates in q_1–8, no
  chat. Production read: OA `user|stats` dump-proven named rows. Full
  contract: [REPUTATION.md](../modules/REPUTATION.md).
- **Acceptance:** grant 5 persists through reconnect/restart; `user|stats`
  shows type:2 5 only when value > 0 and always SUM 36; unknown id / grant 36
  fail-fast. CEF reputation UI not required until a quest consumes the port.
- **Status:** `next`

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
