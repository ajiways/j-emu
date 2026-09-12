# Очередь переноса capabilities

Это канонический порядок работ. Продуктовый факт «что уже работает» хранится
только в [CAPABILITIES.md](../CAPABILITIES.md), а повторяемый процесс — в
[PLAYBOOK.md](PLAYBOOK.md). Граница evidence задана
[SOURCE_BOUNDARY.md](SOURCE_BOUNDARY.md), карта источников —
[EVIDENCE_INDEX.md](EVIDENCE_INDEX.md), известные точки изменения ownership и
общей архитектуры — [ARCHITECTURE_EVOLUTION.md](ARCHITECTURE_EVOLUTION.md).

## Цель очереди: движки, не цикл 1–8

Цель `j-emu` — восстановить **все игровые движки** `jgr-emu` в новой
архитектуре, доказано на representative-выборке данных, чтобы дальше можно
было свободно наполнять их контентом. Конкретный авторский контент (куратские
квесты, полный каталог, все данжи как контент) — не цель и не приоритет;
старая отметка «цикл 1–8» была лишь чек-поинтом черновика, не финальной
границей. Подробности разделения «движок vs контент» —
[SOURCE_BOUNDARY.md](SOURCE_BOUNDARY.md).

Отсюда порядок волн ниже: движки идут по графу зависимостей и архитектурному
риску (сначала то, что тяжелее ретрофитить — stateful combat, — потом более
аддитивные вещи), а не по тому, что нужно конкретной сюжетной цепочке. Прямой
перенос куратского сюжета — отдельный, не блокирующий трек в самом низу этого
документа.

## Правила очереди

- Порядок записей обязателен; capability берётся только после всех
  `depends_on`.
- Workflow-статусы: `done`, `next`, `queued`, `deferred`, `excluded`. Отдельного
  `post-core` больше нет — economy/social/instances/professions не «после
  ядра», они и есть часть ядра движков.
- Ровно одна запись имеет статус `next`.
- Architecture checkpoint заполняет architecture agent до coding. Допустимые
  итоги: действующие ADR достаточны; нужен новый ADR; нужен отдельный
  `ARC-*`; capability надо переупорядочить.
- `Content set` для capability, расширяющей механику до generic-случая,
  означает: representative-выборка, покрывающая каждую ветку правила
  legacy-документа, **и** отдельно поставленная задача массового импорта
  домена (см. `CONTENT_MATRIX.md`), если для этого домена такой задачи ещё
  нет. Полный объём каталога не требование для статуса capability, но не
  должен откладываться неопределённо — см. `CONTENT_PIPELINE.md` §
  `playable-slice.json`.
- Player/runtime state не является content.
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
  resolved from the resulting boundary and remains 2 throughout L1–L14; bag
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

## Wave 4 — economy foundation and reputation

Первая вертикаль economy поднята сюда из бывшего «post-core» — она такой же
движок, как inventory или world, и не обязана ждать квестового контента.

### ECO-01 — First store vertical

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
- **Status:** `done`

## Wave 5 — inventory and character engine generality

Текущий INV-02…04 срез поддерживает 3 предмета и один пример на тип действия.
Эта волна доводит инвентарный движок до generic-случая из legacy-документов —
никакого нового content-объёма сверх representative-выборки, но код должен
работать для произвольного предмета такого типа.

### INV-05 — Durability, death loss and repair

- **ID:** `INV-05`
- **depends_on:** `INV-02`, `CMB-04`
- **Behavior evidence:** legacy `INVENTORY_USE.md` § «Прочность и Мастерская»,
  `src/durability.ts`, `src/durabilityApply.ts`, `src/store.ts`
  `handleStoreRepair`, `src/fight/rewards.ts` (death after non-practice
  finish), `src/items.ts` broken PUT_ON, dump
  `_research/from_register/interesting_full.json` and
  [INVENTORY.md](../modules/INVENTORY.md).
- **Content set:** bump `playable-slice/v14` → **v15**. Every published
  artifact has explicit integer `durability`/`durabilityMax` (`0`/`0` =
  does not track). Representative paperdoll occupancy bits, dump-proven L1
  greyset + already published store gloves: **21** FOOT `1` 30/30, **20**
  BODY `2` 30/30, **26** LEG `4` 30/30, **24** MGLOVE `16` 30/30 (L2),
  **9095**/**23** slot `32` 3/3 and 30/30. Starter bag adds 20/21/26 (not
  pre-equipped). Trophy **103** (expire) and remaining PROTOCOL bits
  (BELT/WEAPON/HEAD/…) stay DATA-02 — do not invent. Mass import — DATA-02.
- **Architecture checkpoint / decision:** complete — existing ADRs and
  ECO-01/CMB-03 composition UoW are sufficient; no `ARC-INV` / `ARC-ECO` /
  `ARC-CMB`. Inventory owns instance `items.durability` /
  `durability_max` (columns, not JSON) and mutations (break, auto PUT_OFF,
  1/1 destroy, repair). Catalog owns authored template durability and
  `priceMinor`/`flags`. Character owns `debitMoney` for repair gold.
  Combat does not write `items`; `HuntFightSettlement` calls inventory
  `applyDeathDurability` in the same UoW as `noteDefeat` when hp is 0
  (hunt only; no practice fights). Repair is composition `StoreRepair`:
  inventory `repair` + `debitMoney`; inventory does not write `heroes`.
  No economy module, ledger, or `flags_ext` column (infinite = `flags`
  NON_BREAK + COLLECTS_EPICNESS only; draconis DATA-02). RNG is injected
  `RandomSource.unit` already on settlement. Chat «Вещи потеряли
  прочность» is `SOC-01`. `store|repair` is OA `{ id }`, not store-area
  gated (live). Full contract: [INVENTORY.md](../modules/INVENTORY.md),
  [STORE.md](../modules/STORE.md).
- **Acceptance:** generic for any item with `durabilityMax > 0`. Death
  picks 4–5 equipped tracking items (or the whole pool if smaller), −1
  each; `0/N` auto PUT_OFF to bag (vitals recalc); finite `1/1` deletes;
  PUT_ON of `0/N` is **204** `Эту вещь нельзя надеть!` (INV-01
  level/gender WearDenied stays **203**). `store|repair` cost
  `min(50, round(priceGold×0.02×100)/100)` gold, result finite
  `(max−1)/(max−1)`; insufficient gold status **2**; cannot repair **203**
  `нельзя починить`. Persist reconnect/restart. Concurrent repair one
  winner. CEF: equip four L1 durables, die to Gryzl, see auto-unequip of
  broken, repair in 504 workshop.
- **Status:** `done`

### INV-06 — Upgrade / enchant chain

- **ID:** `INV-06`
- **depends_on:** `INV-05`
- **Behavior evidence:** legacy `INVENTORY_USE.md` upgrade §, resonator.
- **Content set:** representative upgrade chain (типы 1–3) на одном предмете;
  generic engine — любой предмет с объявленной chain.
- **Architecture checkpoint / decision:** mutate in place, same
  `inventory.items.id`. Overlay columns `upgrade_id` / `upgrade_level` /
  `upgrade_skill_id` / `upgrade_bound` on the item row (not JSON). Catalog
  owns crystal `ARTIFACT_UPGRADE` and named tables types 1–3. RNG is
  `{ unit(): number }` on `InventoryService`, not combat `RandomSource` in
  inventory domain. One UoW: consume crystal, then update target; roll-fail
  **commits** the consume. Type 4 → `203`
  `"Это действие предмета пока не поддержано."`. Fight → `203`
  `"нельзя во время боя"`. Equipped/pocket targets unsupported. ADR-0017–0020
  sufficient; `ARC-*` не нужен.
- **Acceptance:** 6-ступенчатая заточка работает для произвольного предмета с
  combat-stat pool; резонатор **перебрасывает стат на той же ступени**, не
  сбрасывает уровень; тип 4 explicitly `203`, не молча игнорируется.
- **Status:** `done`

### INV-07 — Set bonuses and gear-spell hook

- **ID:** `INV-07`
- **depends_on:** `INV-01`, `INV-05`
- **Behavior evidence:** legacy `INVENTORY_USE.md` set-bonus §, `GEAR_SPELL.md`.
- **Content set:** комплект рекрута **47**: paperdoll **30/33/35/27/28**
  (live `RECRUIT_5`) + bonus articule **106**; mix-доказательство **43**
  (trend 1) и **46** (trend 3). Dump: Pub1 `artifact_artikul_*.amf`.
  Полный каталог сетов — массовый импорт. Slice публикует dump-proven
  `level_boundaries` 9–14 (`XP_TABLE`; L15 не публикуем — dump `expMax=expMin`)
  чтобы L12 шлем рекрута надевался.
- **Architecture checkpoint / decision:** set-bonus считается по
  `extra.set.id` / `set_id`, не по `trend`. `trend` 1/2/3 — запрет микса на
  PUT_ON (`204` «Эту вещь нельзя надеть!»; trend 0 мешается со всеми).
  Порог: N paperdoll вещей одного `set_id` → старший `bonusK` с K ≤ N.
  Бонус — каталожный артикул kind 139 / type 9, persist как
  `inventory.items` `location_kind=tempeffect`, wire slot `134217728`,
  `expire:0`, `cnt:0`. Портрет с 4 вещей: overlay `user|view.avatar_big` /
  `user|unitframe.avatar_small` из `extra.set.avatar_*`, hero appearance не
  пишется. Gear-spell: inventory отдаёт read-only `extra.spell` с nonempty
  `effects` (combat attach — GEAR-01, без импорта combat-таблиц). ADR-0017–0020
  достаточны; `ARC-*` не нужен.
- **Acceptance:** 4 вещи сета 47 меняют портрет; 5-я вешает TEMPEFFECT **106**
  и его `artifact_skills`; PUT_OFF бонуса при надетых кусках возвращает
  строку; trend 1+3 → `204`; неизвестный bonus articule — fail-fast
  публикации.
- **Status:** `done`

### INV-08 — Full USE pipeline generality

- **ID:** `INV-08`
- **depends_on:** `INV-04`
- **Behavior evidence:** legacy `INVENTORY_USE.md` full pipeline,
  `ITEM_NPC_DIALOG.md`.
- **Content set:** по одному representative предмету на каждую ветку:
  DRINK/TEMPEFFECT, dialog-open, multi-step script, bonus_id resolution.
- **Architecture checkpoint / decision:** typed USE registry. This slice:
  DRINK→TEMPEFFECT (640), empty code+bonus skill book (623/601), consume/grant
  script (2371→55 / 2827), NPC dialog-open (584) returns `203`. ADD_MP
  dispatcher exists; no L1 dump item in the slice. Unknown op → `203`.
  System chat for books is SOC-01 and is not faked.
- **Acceptance:** each pipeline branch has raw-AMF E2E on its representative;
  unknown/NPC op is `203`, never silent `100`. CEF skipped until the content
  editor can grant items.
- **Status:** `done`

## Wave 6 — combat engine generality

Текущий combat работает только с одним ботом (Gryzl, spawn 50310) и тремя
предметами. Эта волна убирает захардкоженность самого движка — контент
по-прежнему остаётся representative-выборкой, но правила становятся общими.

### CMB-05 — Generic damage formula

- **ID:** `CMB-05`
- **depends_on:** `CMB-01`
- **Behavior evidence:** legacy `FIGHT_DAMAGE.md` (invented/empirical —
  переносится как `legacy behavior`, не live parity).
- **Content set:** 2–3 representative бота/оружия разного архетипа (лёгкий
  melee, тяжёлый melee, дальний) для проверки формулы на разных входах.
- **Architecture checkpoint / decision:** `BattleRules` knobs
  `strPerDamagePoint=10` / `damageSpread=0.15` (`legacy behavior`). STR
  snapshot на `HuntStartInput`/`HuntJoinInput`; combat не читает character
  tables. ADR-0017–0020 достаточны, `ARC-*` нет. Dodge/crit/choke вне среза.
- **Acceptance:** урон считается по формуле от входных статов участников, не
  по хардкоду под bot id 2; existing CMB-01 acceptance не регрессирует.
  CEF не прогонялся — см. [CEF_MANUAL.md](CEF_MANUAL.md).
- **Status:** `done`

### CMB-06 — Bot AI and spellbook casting

- **ID:** `CMB-06`
- **depends_on:** `CMB-02`, `CMB-05`
- **Behavior evidence:** legacy `BOT_SPELLS.md`, `botAi.ts`, `botSpells.ts`
  (invented frequencies — `legacy behavior`).
- **Content set:** dump-proven offensive books on Hissa **4** / 50101 (396
  `magic_direct`, `pcSTR: -50`), Spirit **32** / 50102 (422 `magic_darkball`),
  Red gryzl **24** / 50103 (394); Gryzl **2** empty book. Full
  `bot_spell_book.json` — DATA-03, не эта capability. Heal+AOE dump-бот
  (Пещерный огр 99, area 542) не в playable 503/501/504 — не добавлять
  (WLD). Движок всё же принимает kind-2 heal и `targetCount>=2` AOE.
- **Architecture checkpoint / decision:** complete. Выбор AI — чистая
  функция `pickBotSpell` в combat domain, не scheduler/process. Книга
  снапшотится на ATTACK_BOT (`HuntStartInput.botSpellBook`); combat не
  читает catalog mid-fight. Catalog `BotDefinition.spellBook`; execution
  blob живёт на карточке книги (нет type_id 72 dump в репозитории). Kind-1
  урон: `STR/10 × (1+pcSTR/100)` затем тот же `damageSpread`, что melee.
  Charging/self-buff 397/428/395, DoT ticks, MAGSTR/MAGRES, virus 631,
  summon — вне среза. Пустая книга не зовёт `random.unit()`. ADR-0017–0020
  достаточны, `ARC-*` нет.
- **Acceptance:** бот с книгой кастует по книге (raw-AMF Hissa 50101
  `magic_direct`); бот без книги остаётся melee-only (Gryzl regression).
  CEF не прогонялся — см. [CEF_MANUAL.md](CEF_MANUAL.md).
- **Status:** `done`

### CMB-07 — Generic weighted loot table engine

- **ID:** `CMB-07`
- **depends_on:** `CMB-03`
- **Behavior evidence:** legacy `FIGHT_LOOT.md` full weighted-table algorithm.
- **Content set:** переиспользует существующий `bot_loot_entries`; расширение
  до полного корпуса — DATA-03 bulk import, не эта capability.
- **Architecture checkpoint / decision:** complete. `rollBotLoot` — чистая
  domain-функция от `BotReward` + `RandomSource`; combat/catalog не читают
  mid-roll. Произвольное число entries/весов уже в алгоритме (guaranteed
  `drop_weight=0`, weighted pool, NOTHING, bonus `2^(max-n)`). Quest/dungeon
  conditioned entries — отдельные policy-документы (CMB-09 / DNG), не
  создавать. ADR-0017–0020 достаточны, `ARC-*` нет. Не объединять с
  `pickBotSpell`.
- **Acceptance:** таблица лута работает для произвольного набора entries и
  весов: одна entry, равные веса, `nothing_weight` доминирует; Gryzl 50310
  может выдать **77** (raw-AMF). Empty tables 4/24/32 остаются пустыми.
  CEF не прогонялся — см. [CEF_MANUAL.md](CEF_MANUAL.md).
- **Status:** `done`

### CMB-08 — Duels and team shuffle

- **ID:** `CMB-08`
- **depends_on:** `CMB-01`, `CMB-04`
- **Behavior evidence:** legacy `FIGHT_JOIN.md`, `duel.ts`, `swap.ts`.
- **Content set:** нет нового контента — чистая механика поверх
  существующего combat loadout.
- **Architecture checkpoint / decision:** действующие ADR-0017–0020
  достаточны, `ARC-*` нет. Active fight остаётся RAM (ADR-0020). `FightDuel`
  — pairing + счётчики ударов на том же `Battle` (hunt human↔bot и
  friendly human↔human). bot↔bot — leftover `QST-ENG-02`, не этот срез. Shuffle 3↔3 —
  реорганизация pairing, не новая сущность: `PAIR_HITS_TO_SWITCH = 3`.
  Playable slice — 1 бот; representative path — 2 hunters × 1 bot, waiter
  получает бота, актор `oppwait`, HP/loadout без сброса. Cross-swap двух
  живых 3↔3 пар — leftover (нет второго dump-бота в одной точке). No-rotate
  — reset hits на месте. Invites process-local, TTL 60s через `Clock`, ключ
  target accountId; restart/TTL → `203` «вызов устарел». OA
  `user|friendly_duel_propose` / `accept`; esrv `user|friendly_duel_request`
  и `fight|conf` challenger-у. Practice settlement восстанавливает HP/MP/
  pocket, без лута/EXP/травмы; history type 6 — leftover. OA `FIGHT_JOIN` /
  `FIGHT_HELP` вне среза. CEF не прогоняется.
- **Acceptance:** friendly duel propose/accept работает между двумя героями;
  shuffle 3↔3 перераспределяет живых участников без потери HP/state.
  CEF не прогонялся — см. [CEF_MANUAL.md](CEF_MANUAL.md).
- **Status:** `done`

### CMB-09 — Quest-fight mode hook (engine only)

- **ID:** `CMB-09`
- **depends_on:** `CMB-03`, `CMB-04`
- **Behavior evidence:** legacy `QUEST_DIALOG.md` `mode:quest`/`win_fight`,
  `questKills.ts`.
- **Content set:** один синтетический тестовый quest-fight hook (не
  куратский контент) — доказывает, что combat умеет отдавать `on_win`/
  `on_lose` сигнал произвольному вызывающему модулю.
- **Architecture checkpoint / decision:** действующие ADR-0017–0020
  достаточны, `ARC-*` нет. Active fight остаётся RAM (ADR-0020). CMB-03
  владеет HP/EXP/loot UoW; quest не пишет `heroes`/`items`. Combat отдаёт
  terminal outcome тем же `FightTerminalObserver`, что `HuntLockRelease`:
  notice содержит `purpose`, `winnerTeam`, `outcome`. Вызов квеста —
  `CombatPort.startHunt` с обязательным `purpose: "hunt" | "quest"` (карта
  ATTACK_BOT всегда `"hunt"`). Quest-модуль подписывается через fan-out
  observer в composition, combat quests не импортирует. Join в `purpose:
"quest"` — `HuntJoinDenied`. Roster allies/enemies, `flags:"8"`, chat_*, bot↔bot —
  `CMB-10`. Deny leave / ambush / QL-2 — `QST-ENG-04` (`done`). Restart mid-fight
  без `on_win`/`on_lose` (нет RAM). CEF не прогоняется.
- **Acceptance:** внешний вызывающий модуль может запросить fight с
  `purpose: "quest"` и получить `on_win`/`on_lose` без изменения
  ownership terminal settlement из CMB-03.
- **Status:** `done`

### CMB-10 — Quest fight roster

- **ID:** `CMB-10`
- **depends_on:** `CMB-09`
- **Behavior evidence:** [QUEST_DIALOG.md](../../../jgr-emu/docs/QUEST_DIALOG.md)
  `mode:"quest"`: solo human, `fight|conf.flags:"8"`, без join, `skipQuestKills`,
  teams герой+allies = **2** / enemies = **1**, `chat_start`/`chat_win`/`chat_lose`
  как MSG; bot↔bot = тот же `FightDuel` + bot AI
  ([FIGHT_MODEL.md](../../../jgr-emu/docs/FIGHT_MODEL.md)). Не засада `chance`.
- **Content set:** синтетика, не Акрилон. Расширить `START_FIGHT` уже
  существующего `q_engine_fight` **нельзя** (сломает 1v1 e2e). Новый ключ
  `q_engine_roster` на NPC **271**: enemies bot **2**×1 + bot **32**×1,
  ally bot **4**×1 (все уже в slice). Ботов 83/84/85/88/89/90 не тащить.
- **Architecture checkpoint / decision:** complete. ADR-0017–0020 достаточны;
  отдельный ADR и `ARC-CMB` не нужны. Active fight RAM. `startQuestFight`
  сейчас берёт только `enemies[0]` и игнорирует `count`/`allies` — это баг
  относительно authored roster, не новый owner.
  **Владение.** Combat — ephemeral bot IDs, pairing, `purpose:"quest"`.
  Catalog — bot rows. `QuestDesk` после commit вызывает `startHunt` с полным
  roster; `chat_*` — `ChatDesk.deliverSystem` (не combat). Join по-прежнему
  `HuntJoinDenied`.
  **Wire.** `fight|conf.flags:"8"`; piggyback как CMB-09/QST-ENG. Roster
  (больше одного бота) ставит `skipQuestKills` — kill-signal не идёт, чтобы
  не бампить чужой `q_engine_fight` на kill. 1v1 quest-fight по-прежнему
  бампает kill. `win_fight` бампает. Deny leave — leftover.
  **Fail-fast.** Пустой enemies; нет bot в catalog; неизвестный script type.
  Нет fallback на Грызля **2**, если roster другой.
  **Restart.** Mid-fight RAM без `on_win`/`on_lose`.
  **CEF.** Production consumer (`fight|conf`). Не прогонялся —
  [CEF_MANUAL.md](CEF_MANUAL.md). Контракт: [COMBAT.md](../modules/COMBAT.md).
- **Acceptance:** raw-AMF: dialog START_FIGHT поднимает бой 1 human + 1 ally
  bot vs 2 enemy bots, flags 8, chat_start; победа → `win_fight`, kill-цели
  Gryzl не бампаются; проигрыш не закрывает `win_fight`; restart в бою рвёт
  RAM. Product **частично** до CEF.
- **Status:** `done`

### WLD-03 — Hunt wander/respawn as a generic scheduler

- **ID:** `WLD-03`
- **depends_on:** `WLD-02`
- **Behavior evidence:** legacy `huntWorld.ts`, `huntWander.ts`, `SYNC.md`.
- **Content set:** 2–3 representative spawn'а с разным route/zone/respawn —
  массовый импорт `hunt_spawns.json` целиком — DATA-04, не эта capability.
- **Architecture checkpoint / decision:** действующие ADR-0017–0020
  достаточны, `ARC-*` нет. Authored route/zone/wait/respawn — колонки
  `world.hunt_spawns`. Live motion process-local (`HuntWanderRuntime`) на
  общем `DelayScheduler` (тот же port, что CMB-01), не per-spawn
  `setInterval`. RNG injected. 50310 остаётся home park без выдуманного
  маршрута. Catalog speed join'ом, не копируется в spawn document.
- **Acceptance:** произвольный authored spawn с route/zone бродит и
  респаунится по своим authored таймингам, не только статичная точка 50310.
- **Status:** `done`

## Wave 7 — economy engines

`ECO-01` уже поднят в Wave 4. Здесь — остальная economy как generic-движки,
без ожидания квестового контента.

### ECO-02 — Generic store engine

- **ID:** `ECO-02`
- **depends_on:** `ECO-01`
- **Behavior evidence:** legacy `STORE.md`, `INVENTORY_USE.md`.
- **Content set:** 2–3 representative магазина с разными currency/gate (gold,
  diamond, barter, LEVEL/RANK/REPUTATION requires); массовый импорт всех 23
  файлов — отдельная DATA-05 задача.
- **Architecture checkpoint / decision:** closed — generic `StorePurchase` на
  `store_lots.pay` / `requires`; gold / diamond / barter; RANK / REPUTATION /
  LEVEL на лоте. Отдельный `ARC-ECO` и `src/modules/store-engine` не нужны.
  Бартер списывает bag по catalog `artikul_id`, не по instance `items.id`.
  Контракт: [STORE.md](../modules/STORE.md).
- **Acceptance:** магазин с любым authored набором лотов и валют проходит
  list/buy/gate raw-AMF E2E; `store|repair` вкладка — если не покрыта INV-05.
- **Status:** `done`

### MAIL-01 — Mailbox and plain messages

- **ID:** `MAIL-01`
- **depends_on:** `INV-02`
- **Behavior evidence:** legacy `MAIL.md` and `src/mail/`.
- **Content set:** mail-макросы/шаблоны и welcome message policy.
- **Architecture checkpoint / decision:** closed — модуль `mail` владеет
  `mail.letters`; send postage — composition UoW + `debitMoney`; отдельный
  `ARC-SOC` / `social` mailbox не нужны. Welcome — named `WELCOME_LETTER`, не
  catalog. Вложения/COD/sweep — MAIL-02. Контракт: [MAIL.md](../modules/MAIL.md).
- **Acceptance:** inbox/outbox, plain send/delete и welcome letter
  restart-safe, paginated, точный list/macros wire.
- **Status:** `done`

### MAIL-02 — Attachments, COD and expiry

- **ID:** `MAIL-02`
- **depends_on:** `MAIL-01`, `ECO-02`
- **Behavior evidence:** legacy `MAIL.md` attachment/COD/TTL flows.
- **Content set:** TTL и fee policy.
- **Architecture checkpoint / decision:** closed — snapshot
  `mail.letter_attachments` (не JSONB и не live `items` reservation);
  take-by-`items.id`; pick/retract/sweep `SELECT FOR UPDATE` в composition
  UoW; TTL sweep на list и общем `DelayScheduler` ~30с, не worker. Chat не
  имитировать. Контракт: [MAIL.md](../modules/MAIL.md).
- **Acceptance:** send attachments/gold, COD, pick/batch-pick, retract и
  return-on-expiry имеют одного победителя в гонке и никогда не теряют
  владение.
- **Status:** `done`

### AUC-01 — Auction listings and bids

- **ID:** `AUC-01`
- **depends_on:** `MAIL-02`, `ECO-02`
- **Behavior evidence:** legacy `AUCTION.md` and `src/auction/`.
- **Content set:** auction configuration и fee policy.
- **Architecture checkpoint / decision:** closed — модуль `auction` владеет
  `auction.listings` (снимок колонок, не JSONB и не live reservation);
  ставка лежит на лоте; settlement — mail `deliverSystemInbox` в composition
  UoW; `SELECT FOR UPDATE`; sweep на list и общем `DelayScheduler` ~30с.
  Отдельный `ARC-ECO` / ledger / депозит не нужны. Tenders — AUC-02 (тот же
  `auction.listings`). Контракт: [AUCTION.md](../modules/AUCTION.md).
- **Acceptance:** list/page/my-lot/my-bid, add, bid, buyout, cancel и expiry
  races имеют одного победителя и durable mail settlement.
- **Status:** `done`

### AUC-02 — Auction tenders

- **ID:** `AUC-02`
- **depends_on:** `AUC-01`
- **Behavior evidence:** legacy `AUCTION.md` tender flows.
- **Content set:** tender fee/limit policy.
- **Architecture checkpoint / decision:** closed — tenders на `auction.listings`
  `kind=tender`; hold = оставшийся `buyout_minor`; fill `SELECT FOR UPDATE`;
  settlement mail. Контракт: [AUCTION.md](../modules/AUCTION.md).
- **Acceptance:** tender create/sell/cancel и concurrent partial fills никогда
  не продают больше количества и не дублируют оплату/доставку.
- **Status:** `done`

### TRD-01 — Direct trade session

- **ID:** `TRD-01`
- **depends_on:** `INV-02`
- **Behavior evidence:** legacy `TRADE.md` and `src/trade/`.
- **Content set:** trade fee policy.
- **Architecture checkpoint / decision:** closed — process-local `trade`
  sessions; tray ids ephemeral from 1; disconnect keeps the same RAM session;
  process restart drops open trays. Контракт: [TRADE.md](../modules/TRADE.md).
- **Acceptance:** request/accept/cancel, item/money offers и
  confirmation-key rotation держат один process-local session consistent
  через disconnect.
- **Status:** `done`

### TRD-02 — Direct trade settlement

- **ID:** `TRD-02`
- **depends_on:** `TRD-01`, `ECO-02`
- **Behavior evidence:** legacy `TRADE.md` settlement и tax evidence.
- **Content set:** validated tax policy.
- **Architecture checkpoint / decision:** closed — одна composition UoW на
  оба героя: canFit снимков, debit pledged+tax, credit pledged партнёра,
  grant снимков; serial gate. Контракт: [TRADE.md](../modules/TRADE.md).
- **Acceptance:** double confirmation меняет предметы/деньги один раз,
  списывает документированный налог и отклоняет NOGIVE/stale offers без
  дублирования.
- **Status:** `done`

## Wave 8 — social engines

### SOC-01 — Chat

- **ID:** `SOC-01`
- **depends_on:** `RTM-01`
- **Behavior evidence:** legacy `CHAT.md`, `chat.ts`, `chatMacros.ts`,
  `QUEST_MACROS_CHAT.md`, `lootNotify.ts`.
- **Content set:** approved macros/smiles плюс system templates для fight/loot
  settlement notifications (замена бывшего `CHT-01`).
- **Architecture checkpoint / decision:** отдельный `ARC-SOC`/`ARC-RTM` не
  нужен. Модуль `chat` без таблиц; fan-out process-local `EsrvOutbox`;
  `ChatFightSettlement` вызывает chat **после** UoW; combat не импортирует
  chat. Контракт: [CHAT.md](../modules/CHAT.md).
- **Acceptance:** area/private/system сообщения и требуемые макросы доходят до
  правильного канала без утечки session-данных; fight/loot system messages
  доходят через esrv после durable settlement без rollback committed rewards
  при сбое доставки.
- **Status:** `done`

### SOC-02 — Party

- **ID:** `SOC-02`
- **depends_on:** `SOC-01`, `CMB-04`
- **Behavior evidence:** legacy `PARTY.md`, `FIGHT_JOIN.md`, party runtime.
- **Content set:** party UI/config документы, если нужны.
- **Architecture checkpoint / decision:** отдельный `ARC-SOC` не нужен.
  Модуль `party` (`src/modules/party`), таблицы `party.parties` /
  `party_members` / `party_invites`; bag table — SOC-03. Serial `FOR UPDATE`
  - unique `hero_id`. Esrv `4:<partyId>` через outbox channel. Combat не
    импортирует party. Контракт: [PARTY.md](../modules/PARTY.md).
- **Acceptance:** create/invite/accept/kick/leave/disband, leadership,
  settings и party chat остаются consistent через reconnect и параллельные
  изменения состава.
- **Status:** `done`

### SOC-03 — Party bag, grouploot and fight HELP

- **ID:** `SOC-03`
- **depends_on:** `SOC-02`, `CMB-08`
- **Behavior evidence:** legacy `PARTY.md`, `FIGHT_LOOT.md`, `FIGHT_JOIN.md`.
- **Content set:** loot-rule конфигурация только.
- **Architecture checkpoint / decision:** отдельный `ARC-SOC` не нужен.
  ADR-0017–0020 достаточны. `party.party_bag_items` (identity id, artikul_id
  каталога, cnt, unix `remove_time`, TTL 3h). Inventory transfer только
  через `grantToBag` / `canFitBag` в composition UoW. Combat не импортирует
  party: `FightLootRouting` + `PartyBagDeposit`. `FIGHT_JOIN`/`FIGHT_HELP` —
  hunt team 1, same-area, dump 204. Dungeon lottery / quest personal_only /
  team 2 — leftover. Контракт: [PARTY.md](../modules/PARTY.md).
- **Acceptance:** все поддержанные loot rules, party bag give/drop и
  same-area HELP/JOIN settle один раз и дают упорядоченные
  party/personal pushes.
- **Status:** `done`

## Wave 9 — instance engines

### DNG-01 — Instance and dungeon foundation

- **ID:** `DNG-01`
- **depends_on:** `SOC-03`, `CMB-04`, `ECO-02`
- **Behavior evidence:** legacy `DUNGEON.md` and dungeon catalog.
- **Content set:** один representative данж (самый маленький из
  `fixtures/dungeons/*.json`) как generic instance engine proof; остальные —
  массовый импорт после того, как движок доказан, не 7 отдельных capability
  с нуля.
- **Architecture checkpoint / decision:** complete — отдельный ADR не нужен
  (ADR-0016, ADR-0018, ADR-0020). `ARC-INS` закрыт ownership, не coding
  slice: модуль `instance` (`src/modules/instance`) владеет copies / binds /
  expiry / killed spawns; world остаётся outdoor areas/hunt; party —
  membership; combat не импортирует instance. Dungeon и BG делят copy
  identity и type, не membership/score. Representative: ogre cave artikul
  `1`. Контракт: [INSTANCE.md](../modules/INSTANCE.md).
- **Acceptance:** authored instance definition создаёт копию, bind'ит членов
  party, изолирует area/hunt state, expire'ится и возвращает участников без
  хранения active combat в PostgreSQL.
- **Status:** `done`

### DNG-02 — Remaining dungeons as bulk content

- **ID:** `DNG-02`
- **depends_on:** `DNG-01`
- **Behavior evidence:** остальные authored dungeon JSON
  (`fixtures/dungeons/*.json`) как evidence для generic instance engine, не
  7 отдельных ручных capability.
- **Content set:** remaining `has_clear: false` fixtures in the typed dungeon
  document (kopi 11/654/bot 354, tomb 12/653/bot 353, usadba 14/673/bot 373)
  plus parent areas 541/651/499 and door links `flags` 256. Bundle
  `playable-slice/v22`. POST-03 mass fixture importer stays deferred.
- **Architecture checkpoint / decision:** complete — отдельный ADR не нужен
  (ADR-0016, ADR-0018, ADR-0020). Typed dungeon document + validator уже
  generic: N данжей в одном bundle без per-dungeon кода. Spawn document
  получает `zone` (XOR с `route`, как outdoor hunt) в
  `catalog.dungeon_spawn_zones`, не jsonb и не отдельный mapper на данж.
  `has_clear: true` (2/4/6/7), `loot.bands`, coins, shops — leftover:
  `instanceConf` fail-fast на progress bar, а bots/areas/loot artifacts нет в
  ACTIVE-MIN. Контракт: [INSTANCE.md](../modules/INSTANCE.md).
- **Acceptance:** каждый опубликованный `has_clear: false` данж проходит
  enter/bind/hunt/exit/rejoin/expiry без runtime JSON reads и без кода на
  дополнительный данж.
- **Status:** `done`

### BG-01 — «Раскоп» queue and match

- **ID:** `BG-01`
- **depends_on:** `SOC-02`, `CMB-04`
- **Behavior evidence:** legacy `BATTLEGROUNDS.md`, `HEROISM.md`, `src/bg/`.
- **Content set:** одна карта Раскопа как proof; остальные BG-карты —
  массовый импорт после доказанного движка.
- **Architecture checkpoint / decision:** complete — отдельный ADR не нужен
  (ADR-0016, ADR-0018, ADR-0020). `ARC-INS` уже закрыл ownership: dungeon
  binds vs BG match policy на общем `instance.copies` identity
  (`copy_type` `dungeon|bg`), без общей membership-таблицы и без legacy
  `BG_INSTANCE_BASE`. Модуль `battleground` владеет RAM queue/invite/ban/
  live score и typed history; `instance` — только bg-copy row; `combat` не
  импортирует battleground (composition overlay PvP `type:"1"`). Контент:
  одна карта Раскоп (`general|2`, rooms 635/636/637, return 500) в
  `playable-slice/v23`. POST-04 / fairness seal leftover. Контракт:
  [BATTLEGROUND.md](../modules/BATTLEGROUND.md).
- **Acceptance:** два героя queue/confirm, входят в изолированный матч,
  бьются до score/timeout, получают упорядоченные finish-пакеты и
  сохраняют историю; restart чистит только ephemeral queue/match state.
- **Status:** `done`

### BOOK-01 — Bestiary and instance books

- **ID:** `BOOK-01`
- **depends_on:** `DNG-01`, `CMB-07`
- **Behavior evidence:** legacy `BESTIARY.md`, `DUNGEON.md`.
- **Content set:** без нового контента — read model поверх существующих
  combat kills и instance binds.
- **Architecture checkpoint / decision:** complete — отдельный ADR не нужен.
  `character.hero_bot_kills` — durable hunt-win aggregate (не копия RAM боя
  и не 72h `finished_fights`). `book|instances` читает `instance.binds` +
  `copies` без второй таблицы. Контракт:
  [BOOK.md](../modules/BOOK.md).
- **Acceptance:** bestiary kill counters и active/completed instance entries
  совпадают с persisted outcome в точном book wire.
- **Status:** `done`

## Wave 10 — professions engine

### PRF-01 — Profession engine and hero state

- **ID:** `PRF-01`
- **depends_on:** `WLD-02`, `INV-02`
- **Behavior evidence:** legacy profession routes, `assistant.ts` и evidence.
- **Content set:** 1–2 representative профессии (одна добывающая, одна
  крафтовая) как generic engine proof; полный список — DATA POST-02.
- **Architecture checkpoint / decision:** complete — отдельный ADR не нужен.
  `catalog.professions` — authored pair 2+6; `character.hero_professions` —
  лицензии; composition OA/init `user|professions` и `learnProfession`.
  Scheduler / assistants / craft — PRF-02/03. Контракт:
  [PROFESSIONS.md](../modules/PROFESSIONS.md).
- **Acceptance:** representative профессия публикуется и grant/bootstrap
  проходит raw-AMF E2E.
- **Status:** `done`

### PRF-02 — Assistants and gathering

- **ID:** `PRF-02`
- **depends_on:** `PRF-01`
- **Behavior evidence:** legacy assistant work/repeat/revoke/save/create/upgrade
  flows.
- **Content set:** representative resource node/chain.
- **Architecture checkpoint / decision:** complete — отдельный ADR не нужен
  (ADR-0017–0020 + существующий DelayScheduler). Модуль `professions` владеет
  `hero_assistants`, `hero_farm_stats`, `farm_stocks` и sweep. Catalog —
  `assistant_types`, `farm_resources`, `area_farms` в active release.
  Character/inventory только через ports. Clock = `Clock` + `DelayScheduler`;
  finish пишет только sweeper (не `resolveExpired` на OA). RNG — явный
  `{ unit(): number }` в factory, без `Math.random`. Контракт:
  [PROFESSIONS.md](../modules/PROFESSIONS.md).
- **Acceptance:** deploy, finish, claim/repeat/revoke и upgrade переживают
  restart и атомарно дают inventory/mastery/stat изменения.
- **Status:** `done`

### PRF-03 — Crafting

- **ID:** `PRF-03`
- **depends_on:** `PRF-02`
- **Behavior evidence:** legacy craft recipes, cooldown и favorites.
- **Content set:** representative рецепт на каждый уровень мастерства;
  полный корпус рецептов — bulk-import задача.
- **Architecture checkpoint / decision:** complete — отдельный ADR не нужен.
  Catalog владеет `craft_recipes`; professions — `hero_recipes`; character
  bump XP только через port; inventory USE возвращает `learn_recipe`.
  Clock = request-time grant + `ftime` cooldown, без DelayScheduler. RNG —
  тот же `{ unit(): number }`. XP-bands — dump constants в domain.
  Контракт: [PROFESSIONS.md](../modules/PROFESSIONS.md).
- **Acceptance:** craft и favorites дают один output/XP результат после
  authored cooldown и остаются consistent после retry/restart.
- **Status:** `done`

## Wave 11 — quest engine (не куратский контент)

Цель этой волны — механика: движок, способный выполнить произвольное
определение квеста. Куратский сюжет (Акрилон 1–9 и далее) переносить сюда не
нужно — это Content-fill track внизу документа.

### QST-ENG-01 — Board, dialog, book and script engine

- **ID:** `QST-ENG-01`
- **depends_on:** `WLD-01`, `ECO-01`, `REP-01`, `INV-08`, `CMB-09`
- **Behavior evidence:** legacy `QUESTS.md`, `QUEST_DIALOG.md`,
  `QUEST_BOARD_ICONS.md`, `NPC_CATALOG.md`.
- **Content set:** 2–3 синтетических тестовых квеста (не куратский Акрилон),
  выбранных так, чтобы проверить каждый тип goal (talk/kill/loot/buy/equip/
  deliver/area_action) и каждый тип script (`START_FIGHT`, `GRANT_*`, `MSG`,
  flags, waiting AREA).
- **Architecture checkpoint / decision:** complete — отдельный ADR и
  `ARC-QST` не нужны. Модуль `quests` владеет authored NPC/quest/dialog/script
  (`release_id`) и player `hero_quests` / goals / facts / waiting. Catalog не
  держит graph. World — только travel `COME_IN`. `QuestDesk` в composition
  исполняет GRANT/consume/MSG и после commit — CMB-09 `startHunt(purpose:
"quest")`. `QuestSignal` с store/PUT_ON/`FightTerminalObserver`. JSONB нет.
  Clock = request-time waiting + `action_finish`, без DelayScheduler. RNG —
  `{ unit(): number }`. Dialog `START_FIGHT` в этом срезе; AREA→бой, markers
  и loot-cap — `QST-ENG-02`. Контракт: [QUESTS.md](../modules/QUESTS.md).
- **Acceptance:** синтетические тестовые квесты проходят raw-AMF E2E и CEF на
  каждый тип goal/script; движок принимает произвольное authored quest
  definition через content pipeline, не хардкод под конкретный quest key.
- **Status:** `done`

### QST-ENG-02 — World/combat integration hooks

- **ID:** `QST-ENG-02`
- **depends_on:** `QST-ENG-01`, `CMB-09`
- **Behavior evidence:** legacy `QUEST_DIALOG.md`, `QUEST_MAP_MARKERS.md`,
  known-bug list.
- **Content set:** без нового квеста — hook-проверка на трёх ключах
  `QST-ENG-01`. Coding добавляет `START_FIGHT` `mode:"quest"` на существующий
  `q_engine_area` (тот же key / area_action 8), не четвёртый квест и не
  Акрилон.
- **Architecture checkpoint / decision:** complete — отдельный ADR и
  `ARC-QST` не нужны. Те же ADR-0017–0020: `QuestDesk` UoW + post-commit
  CMB-09 `startHunt(purpose:"quest")`. AREA `action_finish` с
  `START_FIGHT` в onFinish текущей `area_action` **не бампает** цель
  (`progress_on_win` по умолчанию); waiting сбрасывается; бой стартует после
  commit, `fight|conf` piggyback на `common|action_finish`. Победа
  `purpose:"quest"` бампает ту же `area_action` и гоняет оставшийся onFinish
  (MSG/SET_FLAG); `win_fight` signal цель `area_action` не закрывает.
  Проигрыш оставляет цель incomplete. Loot-cap — composition
  `HuntFightSettlement` спрашивает quests-port `needed` по текущей
  loot/deliver цели, combat quests не импортирует. Markers: честный
  `finished_quests_id`; `book|quest_targets` только `currentGoal`;
  `area_conf` offer href только NPC-доска / AREA hotspot, не hunt-бот.
  Ложь `mergeFinishedQuestsForMapMarkers` и Pub1 `quest_info` не переносятся.
  Roster allies/enemies, `flags:"8"`, chat_*, bot↔bot — `CMB-10`. Deny leave,
  ambush `chance`, QL-2 — `QST-ENG-04` (`done`). Контракт: [QUESTS.md](../modules/QUESTS.md).
- **Acceptance:** AREA waiting запускает нужный quest-fight через CMB-09
  hook; markers и quest-loot limits работают generic, не per-quest кодом.
- **Status:** `done`

### QST-ENG-03 — Multi-board, JUMP_AREA, awards.rep

- **ID:** `QST-ENG-03`
- **depends_on:** `QST-ENG-02`
- **Behavior evidence:** [QUEST_DIALOG.md](../../../jgr-emu/docs/QUEST_DIALOG.md)
  `JUMP_AREA` → leftover `npc|answer`
  `{ status:100, jump:"area", macros_list:[] }` (не `setArea`; после боя
  локацию тоже не меняет). [QUEST_BOARD_ICONS.md](../../../jgr-emu/docs/QUEST_BOARD_ICONS.md)
  MAIN `flags:32` × pf `8`/`0` = `main_start` / `main_pnt`. Secondary
  `active_only`: скрыта до accept и когда текущая цель не этого NPC.
  Talk bump только если `npcRef` = `goal.objectId`.
  [REPUTATION.md](../modules/REPUTATION.md) `award.rep`
  `{object_id:5, amount:10, cap:0}` внутри `GRANT_AWARDS`; live борд
  `award_rep` всегда `""`. REMOVE_ARTIKUL удаляет экземпляр, в т.ч.
  paperdoll `cnt=0`, без чата «Изъято».
  **Конфликт.** `jgr-emu/docs/QUESTS.md` ещё пишет, что `JUMP_AREA` не
  исполняется / accept jump захардкожен. Канон для j-emu — QUEST_DIALOG +
  `jgr-emu/src/quests/dialog.ts` / `scripts.ts` (`jumpArea=true`, без
  `setArea`). `GRANT_REP` как отдельный op — не этот срез (CONTENT-STORY).
- **Content set:** синтетика, не Акрилон / не `q_1` / не live `book_id`
  90002 / не NPC 1617/2024. File seed `playable-slice/v32` (editor
  `hasReleaseEntry` новых ключей не открывает).
  NPC **271** остаётся в 503, `itemId` **4** (снять с item **1**; USE **584**
  без изменения). После QST-ENG-04 item **1** на 503 занят AREA
  `q_engine_ambush` (плита 2024 — CONTENT-STORY, без коллизии с засадой).
  Запрещены 271/272 на items **1** (плита/засада), **3** (AREA камень), **5**
  (лавка), **7** (ущелье).
  NPC **272** (`id`/`infoId` 272) в 503 `itemId` **8**; title/picture —
  dump-proven Pub1 `images/data/npcs/…`, не копировать плиту 2024.
  `q_engine_multi`: `bookId` **6**, `flags` **32**, `awardExp` **6**,
  `awardRep` `{ objectId:5, amount:10, cap:0 }`. Boards: 271 `pointId` **6**
  `boardOrd` **6** `active_only:false`; 272 `pointId` **7** `boardOrd` **1**
  `active_only:true` + свой `welcome_message`. `scripts.onAccept`:
  `JUMP_AREA` + `GRANT_ARTIKUL` **23**×1. Goals: `talk` `objectId` **272**;
  `win_fight` 1v1 bot **2**, `onFinish` `REMOVE_ARTIKUL` **23** + MSG.
  Существующие talk-цели `q_engine_board` / `q_engine_daily` получают
  `objectId` **271** (иначе новый talk-gate их сломает).
- **Architecture checkpoint / decision:** complete. ADR-0017–0020
  достаточны; `ARC-QST` / новый inventory-модуль не нужны. `npc_quests` уже
  PK `(release, npc, quest)` — добавить `active_only` и per-board
  `welcome_message`; lookup `npc|answer` / `npc|quests` по
  `(npcId, pointId)` строки `npc_quests`, не только `quests.point_id`.
  `JUMP_AREA` в `scriptOpSchema` + leftover как `START_FIGHT` (не исполнять
  в `applyQuestScriptEffect`). `GRANT_AWARDS` зовёт существующий
  `grantReputation`. `REMOVE_ARTIKUL` — тот же public inventory consume по
  `artikul_id`, bag или paperdoll.
  **Владение.** quests — boards/flags/talk-npc/onAccept; character —
  `grantReputation`; inventory — consume bag **или** paperdoll; jugger-wire
  — `jump:"area"` на `npc|answer` (вместо dialog payload). Composition UoW
  (hero lock, как сейчас `QuestDesk.npcAnswer` / turn-in / fight finish).
  Clock/RNG/новые runtime ID не вводятся. Jump не персистится.
  **Fail-fast.** Два NPC на одном `(areaId, itemId)`; NPC hotspot vs travel
  link; talk `kind` без `objectId>0`; `awardRep.objectId` не из catalog /
  грант на 36; неизвестный script type; `JUMP_AREA` не делает `setArea` и
  не телепортирует в 503 «на всякий случай». Нет предмета на REMOVE — skip,
  не 203.
  **CEF.** Production consumer (MAIN доска 271 через USE 584 + `jump` на
  accept). Кликовый хотспот 272 в SWF не доказан — secondary только raw-AMF
  `ref=272` до CONTENT-STORY. Исключение Wave 5–12 закрыто; CEF-PASS не
  выдумывать. Контракт: [QUESTS.md](../modules/QUESTS.md).
- **Acceptance:** raw-AMF: 272 доска пуста до accept и когда цель не talk
  272; talk на 271 при цели 272 не бампает; accept → `jump:"area"` и area
  остаётся 503; `flags:32` pf 8/0; turn-in пишет track **5** +10 (cap 0);
  победа снимает надетый **23**, `fight|finish` отдаёт `user|view.artifacts`.
  Restart: cursor/rep/bag/paperdoll; jump не повторяется. Product
  **частично** до CEF.
  Landed: `0025_quests_multi_board`; `playable-slice/v32`; `5293ece`
  `d4d093e` `9bdebe6` `23374a7`. CEF leftover в
  [CEF_MANUAL.md](CEF_MANUAL.md).
- **Status:** `done`

## Wave 12 — presentation engines

### GEAR-01 — Equipped gear spells

- **ID:** `GEAR-01`
- **depends_on:** `CMB-06`, `INV-07`
- **Behavior evidence:** legacy `GEAR_SPELL.md` (kind-3 без `triggers` =
  старт боя, не прок; `img` с `artikuls.picture`; live emu **не** аттачит
  paperdoll `extra.spell` — wire берётся с того же `attachFightEffect` /
  TEMPEFFECT kind-3: `buildBootstrap` `persEff` затем `effUse`, expire
  `onActorEndingTurn` → `effPurge`). Не путать с `extra.spells[]`
  (CMB-02 комбо). Каталог: Pub1 `artifact_artikul_20546.amf`.
- **Content set:** representative **20546** «Изначальная мифическая
  перчатка тирана VI» (kind 44, слот 32): `extra.spell` `groupId` **936**,
  kind-3 `duration` **320** (8 ходов = 320/40), `pcSTR` **10**, без
  `triggers`. Dump-поля карточки (picture, levelMin, type/kind, skills,
  flags) — из Pub1 AMF, не выдумывать; блоб сверять с цитатой в
  `GEAR_SPELL.md`. `extra.spells[]` комбо 20546 — leftover CMB-02 (уже
  доказано на **9095**); в этот срез сокеты 20546 не тащить и не
  изобретать. Соседи VI (21201/21500/20848/20939), `triggers` /
  `onlyPvP` / kind 9 (эмблемы 11777+) — не этот срез. Полный корпус
  paperdoll-spell — DATA-02, не эта capability.
- **Architecture checkpoint / decision:** complete. ADR-0017–0020
  достаточны; новый ADR и `ARC-*` не нужны (нет новой persistent owner,
  active-fight table или смены wire-dispatch).
  **Владение.** Catalog — authored `extra.spell` на артикуле. Inventory —
  instance paperdoll (`PUT_ON`/`PUT_OFF`) и read-only
  `equippedGearSpells` / `list`; **не** копирует блоб на `items` и **не**
  держит fight effect. Combat — RAM effect registry (`remainTurns`,
  baked skills, `expiresAtMs`); **не** пишет `inventory.items`.
  Composition `HuntCombatLoadout.snapshot` (как pocket/glove CMB-02 и
  bot book CMB-06) кладёт `CombatLoadout.gearSpells[]`
  `{ artikulId, title, picture, spell }` на `startHunt` / `joinHunt` /
  friendly-duel start. Combat domain не импортирует inventory/catalog
  repositories и не читает их mid-fight.
  **Когда в snapshot.** На **старт боя**, не на PUT_ON и не лениво на
  удар: PUT_ON вне боя только меняет location (каталог уже на артикуле);
  в бою layout — `FightRules` `203` «нельзя во время боя»; блоб без
  `triggers` вешается в начале боя (`GEAR_SPELL.md`), это не прок.
  `extra.spells[]` nonempty → прежний CMB-02 fail-fast на сокетах;
  пустые сокеты у 20546 в этом срезе валидны (`glove: null` для комбо,
  gear-spell всё равно в snapshot).
  **Wire order (attach / proc / expire).** Attach — тихий RAM в
  `Battle` create, не OA PUT_ON. Первый fproxy bootstrap (и reconnect
  в том же процессе): после `persSpells` → `persEff` с nested `"1"`
  `{ id, kind:3, persId, sourceId:heroId, artikulId:20546, title,
img:picture, dmgType, remainTime:320, groupId:936 }` → сразу
  `effUse` с теми же полями + `flags:0` + kind-3 `skills` (pcSTR
  печётся в flat STR, как `bakeTimedStatPercents`). Прока **нет**
  (нет `triggers`; лишний `effUse` на удар запрещён). Expire: ход
  кастера (`onActorEndingTurn`; self-buff считает ending action героя)
  декрементит `remainTurns` (8); при `≤0` или wall-clock `expiresAtMs`
  в том же melee poll **после** `cast`/strike, **до** `timeAdvance` /
  `attackwait` / `{rs,sq}`: `{ et:"effPurge", effectId }`. `persEff`
  при expire не пересылается. Melee L/C/R остаётся strike-then-rs.
  Standing kind-3 STR участвует в CMB-05 melee, пока эффект жив.
  Каталожный парсер обязан сохранить authored `duration` /
  `forceSelfTargeting` / `realStartTime`; paperdoll `extra.spell` с
  `triggers` / `onlyPvP` / kind≠3 в опубликованном срезе — fail-fast
  публикации, не silent skip. Нет `Clock.schedule`.
  **Restart / concurrency.** Equipped 20546 в PostgreSQL переживает
  reconnect и process restart. RAM-эффект и бой — нет (ADR-0020).
  Reconnect до restart: bootstrap `persEff`+`effUse` с оставшимся
  `remainTime`. Гонка PUT_ON в бою невозможна (`203`).
  Landed: `playable-slice/v29`, raw-AMF
  `tests/e2e/fproxy-gear-spell.test.ts`. j-emu melee poll без
  `timeAdvance` (CMB-01 `attackwait`+`cast`); `effPurge` после `cast`,
  до `{rs,sq}`. Dump-блоб без `dmgType` — на wire `0` (e2e); live
  `attachFightEffect` подставляет `1`.
- **Acceptance:** raw-AMF: надетый **20546** на ATTACK_BOT (Грызль 50310)
  даёт bootstrap `persEff` затем `effUse` (artikul 20546, `groupId` 936,
  `kind` 3, `img` `dosp_tir_mif_mag.png`, `remainTime` 320); на ударах нет
  второго attach/proc; после 8 ending-ходов героя — `effPurge` в том же
  poll, что strike, до `{rs,sq}`. PUT_ON 20546 вне боя не шлёт fight
  packets. Reconnect в живом процессе сохраняет remaining effect;
  restart процесса бой убивает, строка 20546 в paperdoll остаётся.
  Публикация карточки без dump `duration`/picture или с `triggers` —
  отказ candidate. CEF не прогонялся — Wave 12, [CEF_MANUAL.md](CEF_MANUAL.md);
  product **частично**.
- **Status:** `done`

### HERO-01 — PvP heroism

- **ID:** `HERO-01`
- **depends_on:** `BG-01`, `CHR-01`
- **Behavior evidence:** legacy `HEROISM.md` (изобретённый / best-fit слой,
  не PHP live); рабочий baseline — `jgr-emu/src/bg/honor.ts`
  `rawHonorFromDamage` + `src/honorRank.ts` `addHonor` +
  `src/bg/match.ts` `applyBgFightOutcome`. Dump-проверенные пары Раскопа
  (`_research/giga_dump_2026-08-11`, L6 `hpMax` 108 vs L7 `hpMax` 111,
  `honor_bonus:0`): winner 350→**68**, loser 222→**26**; winner 215→**42**.
  **Конфликт, не замазывать:** `HEROISM.md` `level_penalty` и «в героизм
  только урон по людям» **не** в `honor.ts` / `applyBgFightOutcome`
  (`dealtDamage` без фильтра фантома). Срез идёт за **кодом** `honor.ts`
  (штрафа нет). Раскоп BG-01 — 1v1 без бота/фантома, поэтому
  human-applied damage = весь PvP урон по сопернику; отдельный strip
  фантома не изобретать. Казнь ×2, короны `HONORMOD`, геммы, сферы,
  revenge, `heal_honor`, шахты `5×Base`, печать справедливости — не этот
  срез.
- **Content set:** новый артикул / slice bump **не** нужен. Звания и кап —
  уже опубликованные `common_conf.rank_info` / `rank_table` (STORE RANK /
  `honorProgress`). Ставка `Base(1..35)` — именованный `HeroismRules`
  (таблица как в `honor.ts` / `HEROISM.md`, win **1.4** / lose **0.8**),
  не новая catalog-таблица и не `?? 10`. `level_boundaries.honor_*` —
  leftover chrome; live HUD берёт окно из `honorProgress`. Representative
  сценарий — Раскоп L6–L7 (очередь BG-01). Dump hpMax 108/111 не
  форсить фикстурой: e2e считает `round(Base×dmg/hpMax×mult)` от
  измеренного fight `maxHp`.
- **Architecture checkpoint / decision:** complete. ADR-0017–0020
  достаточны; новый ADR и `ARC-*` не нужны (`ARC-CHAR` уже отклонён на
  CHR-01/REP-01: `heroes.honor` тот же aggregate).
  **Владение.** Catalog — `rank_info`/`rank_table` и `honorProgress` /
  cap (`honorCapForLevel` экспортирован). Combat — RAM 1v1 snapshot:
  `level`, `maxHp`, applied урон по вражеским людям (хилы раздувают
  сумму; кредит как jgr-emu `applied`, не overkill сверх текущего HP
  тика; бот/`damageToBot` не входит), `winnerTeam`. Combat **не** считает
  героизм и **не** пишет `heroes` / BG RAM. Character — persist
  `heroes.honor`, порт `grantHonor` (рядом с `grantExperience` на
  `CharacterProgression`), ledger `honor_grants` PK
  `(hero_id, operation_id)`, clamp через `honorProgress`. Battleground —
  RAM `player.honor` / `dmg` / `rank` (сумма боёв матча) и history
  columns. Composition `HuntFightSettlement.persistPvp` в той же UoW, что
  HP: чистая `rawHonorFromDamage` → `grantHonor`;
  `BattlegroundMatchRuntime.afterFightFinished` читает кэш этого боя
  (оба героя) и копит RAM stats, затем `pushMapAndStats`. Не считать
  формулу второй раз в observer.
  **Когда начислять.** На **финиш PvP-боя** (`purpose:"pvp"`, Раскоп
  `type:"1"`), не на `arena|bg_finish` lump и не на PUT_ON. `mult` — от
  **команды этого боя** (`human.team === winnerTeam`), не от счёта матча
  (в 1v1 совпадает). `last-leave` всё равно persist HP+honor с урона.
  Hunt / friendly-practice / quest — **не** грантят (CMB-03
  `fight|loot.honor:0`, CMB-08 restore без награды). Сырой `raw==0` — не
  вызывать grant (как EXP запрещает 0). `raw>0` при капе звания —
  grant с amount=`raw`, persist clamped (added может быть 0).
  **Ключ.** `pvp:{fightId}:{characterId}`. Повтор — сохранённый result;
  тот же ключ, другой amount — conflict. `settledFights` + unique PK.
  **Wire.** Per-fight honor → live `arena|*` `user_stats.honor` и финиш
  `arena|bg_finish.user_stats.honor` (сумма боёв; `honor_bonus:0`).
  Накопительный `user|unitframe.honor` + окно `honorMin`/`honorMax` /
  `honorStatus` / `rank` из `honorProgress(hero.honor, hero.level)`, не
  из static `level_boundaries`. `user|conf.rank` — тот же live rank
  (до среза `level.honorRank` был 0 на L1–8). OA `user|stats` object 2
  «Героизм» уже читает `hero.honor`. После гранта esrv `user|unitframe` +
  `user|conf` (как `applyBgFightOutcome`). `fight|loot.honor` остаётся
  **0** (CMB-03 leftover; live героизм боя — `fight|info`, INFO не в
  срезе). `arena|leader_rating` `rating:{}` — leftover.
  **Fail-fast.** PvP snapshot не ровно 2 humans; victim level вне 1..35;
  `maxHp < 1`; нет строки `rank_table`. Запрещены legacy `Math.max(1,hp)`
  и `BASE[lv] ?? 10`.
  **Restart / concurrency.** `heroes.honor` и `honor_grants` переживают
  reconnect/restart. RAM матч и незакрытый бой — нет (BG-01 / ADR-0020).
  Финиш боя, commit, затем смерть процесса: honor на герое есть, live
  match stats теряются вместе с матчем. Два concurrent persist — PK.
  Landed: `drizzle/0022_character_honor_grants.sql` (без slice bump);
  raw-AMF `tests/e2e/battleground-raskop.test.ts`; unit dump-пары 68/26/42;
  composition `persistPvpHonor` + `PvpFightHonorCache`; live
  `honorProgress` на unitframe/conf.
- **Acceptance:** raw-AMF Раскоп L6 vs L7, fixed-seed: per-fight honor =
  `round(Base(victimLevel)×dmgToHuman/victimHpMax×(1.4|0.8))` один раз на
  `(fightId, characterId)`; live stats и `arena|bg_finish` показывают
  сумму боёв; unitframe/conf/stats — накопительный honor и live rank
  window; hunt и friendly-duel не двигают honor; restart после commit
  сохраняет `heroes.honor`. Unit-проверка dump-пар 68/26 и 42 на
  зафиксированных hpMax 108/111. Печать / penalty / казнь / короны не
  входят. CEF не прогонялся — Wave 12, [CEF_MANUAL.md](CEF_MANUAL.md);
  product **частично**.
- **Status:** `done`

### DAY-01 — Daily quests

- **ID:** `DAY-01`
- **depends_on:** `QST-ENG-02`
- **Behavior evidence:** legacy `DAILY_QUESTS.md`; рабочий journal/cooldown —
  `jgr-emu/src/quests/dailyCycle.ts` + `book.ts` + `progress.ts`
  `hideHeroQuestByBookId` + OA `book|quest_delete` (`npcBook.ts`). Live dump
  `_research/2players_social_2026-08-11` квесты 75/276 (`flags:1`
  `multitime:1`, не в `finished_quests_id`). **Конфликт, не замазывать:**
  06:00 wipe в jgr-emu **ещё TODO** (`DAILY_QUESTS.md` «Когда будет»,
  `dailyCycle.ts` «Game-day wipe is not implemented»). ROADMAP acceptance
  требует reset/catch-up — этот срез **делает** документированный TODO
  (lazy Clock, не PHP live). Курацию strangers `type:repeat` и live 75/276
  не тащить. `mergeFinishedQuestsForMapMarkers` не переносится (QST-ENG-02).
- **Content set:** четвёртый синтетический квест на NPC **271** в
  playable-slice (bump обязателен): key `q_engine_daily`, `flags` **1**,
  уникальные `bookId`/`pointId`/`boardOrd` (следующие свободные после 1–3),
  talk → `GRANT_AWARDS` (малый EXP, без денег/предметов). Три engine-ключа
  остаются `flags:0`. Publication fail-fast, если нет ровно одного
  `flags & 1` или daily без бита 1. Live 75/276 / данж `257` / MAIN `33` —
  не этот срез.
- **Architecture checkpoint / decision:** complete. ADR-0017–0020
  достаточны; новый ADR и `ARC-QST`/`ARC-*` не нужны.
  **Владение.** Quests — authored `flags`, player `hero_quests` (+
  `hidden_in_journal`), wipe/hide/journal times. Catalog не владеет NPC.
  Character — `grantExperience` с cycle-aware `operationId`. Inventory не
  нужен на representative (нет award items). Combat не участвует.
  Composition `QuestDesk`: UoW, `GRANT_AWARDS`, OA `book|quest_delete`.
  **Цикл 06:00 MSK.** Именованный `DailyCycleRules`: `Europe/Moscow` =
  UTC+3 круглый год, граница 06:00; `Clock.unixSeconds()` (не `Date.now()`,
  не TZ процесса, не `Clock.schedule`, не `DelayScheduler`).
  `nextMoscow6am(t)` / `lastMoscow6am(t)` как `dailyCycle.ts` (строго после
  уже наступивших 06:00 — следующие). Lazy catch-up на каждом quests port
  (board / book / answer / cancel / delete) в той же UoW: daily
  (`flags & 1`) **active** с `startedAt < last6am` и **done** с
  `finishedAt < last6am` — DELETE `hero_quests`+goals (включая незакрытый
  прогресс — как документированный restart). Одноразовые и `256` без бита 1
  не трогать. Нет `ftime:0`+`cooldown:86400`. Нет таблицы
  `server_daily_cycle`.
  **Accept / награда.** `start`/`accept` не поднимает `done`→`active` в том
  же круге (`203`). После wipe строки нет — взять снова. `GRANT_AWARDS` EXP
  ключ для daily: `quest:{heroId}:{key}:exp:{lastMoscow6am(finishedAt)}`;
  одноразовые ключ без cycle как сейчас. Повтор той же сдачи — прежний
  conflict/no-op CHR-01; новый круг — новый ключ. Money/items без ledger —
  в representative 0.
  **Journal / доска.** Active daily: журнал `status:"started"` `multitime:1`
  `ftime:0` `cooldown:0`. Done, не hidden: в `book|quest_list` filter
  `started`/empty как `status:"finished"` `multitime:1` `ftime`=unix сдачи
  `cooldown`=`nextMoscow6am(ftime)-ftime`; **не** в `finished_quests_id`.
  `book|quest_delete` `form.quest_id`=bookId: daily done → `hidden_in_journal=1`
  (строка журнала пропадает, доска всё равно скрыта до wipe); не daily /
  не done — `100` no-op. Piggyback trio, без `state` (live cancel шлёт
  state, delete — нет). Доска: `flags:1` × `point_flags` 8/`0` → `start_m` /
  `pnt_m`; done скрыт (`boardRow` null).
  **Fail-fast.** Нет `flags` у квеста; daily `done` без `finishedAt`;
  неизвестный OA; `quest_id` 0 — `203` «нет квеста». Не `?? 0` на flags.
  **Restart / concurrency.** Progress/hidden переживают reconnect/restart;
  06:00 во время простоя ловится на следующем OA. Лок hero_quests в UoW.
  `quest-desk` / OA registry у лимита 400 — сначала extract, потом
  `book|quest_delete`.
  Landed: `drizzle/0023_quests_daily_journal.sql`
  (`hero_quests.hidden_in_journal`); `playable-slice/v30` `q_engine_daily`;
  raw-AMF `tests/e2e/quest-daily.test.ts`; `ee4b4de`.
- **Acceptance:** raw-AMF: взять/сдать `q_engine_daily` один раз за круг;
  журнал countdown до 06:00 MSK; доска скрыта; `finished_quests_id` без
  этого bookId; `quest_delete` прячет строку; FakeClock за 06:00 → wipe →
  повторный offer и вторая EXP-награда с новым `operationId`; reconnect/
  restart сохраняют active/done до границы. Одноразовые engine-квесты без
  изменений. CEF не прогонялся — Wave 12, [CEF_MANUAL.md](CEF_MANUAL.md);
  product **частично**.
- **Status:** `done`

### ACH-01 — Achievements

- **ID:** `ACH-01`
- **depends_on:** `GEAR-01`, `HERO-01`, `DAY-01`
- **Behavior evidence:** legacy `ACHIEVEMENTS.md` — неполный/stub evidence,
  сам по себе не разрешает реализацию.
- **Content set:** нет, пока не появится отдельно одобренный каталог и
  client-контракт.
- **Architecture checkpoint / decision:** блокирующее product/evidence
  решение; не превращать legacy пустой success в фичу.
- **Acceptance:** требует более сильного evidence прежде чем выйти из
  `queued`.
- **Status:** `deferred`

## Wave 13 — content authoring tooling

Инструменты для наполнения уже построенных движков контентом. Не блокирует
предыдущие волны — типизированные import-порты для bulk-данных уже строятся
по мере DATA-02…06 (`CONTENT_MATRIX.md`); полноценный визуальный редактор
может подождать.

### EDT-01 — Core content editor

- **ID:** `EDT-01`
- **depends_on:** `FND-01`
- **Behavior evidence:** legacy `/dev/content` (`jgr-emu/src/routes/devContent.ts`,
  `content-ui/`, `questEditor.ts`) — только UX; dual-write fixtures **запрещён**.
  Канон: [CONTENT_PIPELINE.md](../architecture/CONTENT_PIPELINE.md), ADR-0018.
  Текущий runtime: `ContentPublicationService.seed`/`publish` из in-memory
  bundle; `persistValidatedBundle` сам вставляет `draft_versions`; отдельных
  `saveDraft` / candidate / report / audit нет.
- **Content set:** существующие `content_type`/`content_key` **active**
  playable-slice/v30. Representative: NPC **271** `title`. Не DATA-02…06
  mass import и не новые ключи.
- **Architecture checkpoint / decision:** complete. ADR-0017–0020
  достаточны; новый ADR и блокирующий `ARC-EDITOR` не нужны.
  **Владение.** `content` — drafts (append-only versions + `created_by`),
  persisted candidate, validation report, publication audit, active pointer.
  Catalog/world/quests/professions — только materialize из валидного bundle.
  Identity не владеет token. Composition: UoW; file `seed`/`publish` не
  смешивать с editor-activate.
  **Auth.** `CONTENT_OPERATOR_TOKEN` обязателен в `loadConfig` (нет default).
  HTTP `Authorization: Bearer`; timing-safe; 401 без token. Один оператор
  `created_by="operator"`. Не player session, не OA.
  **HTTP.** `/operator/content/*` JSON, не AMF. Тело = существующий `*`
  Buffer parser → `JSON.parse` + DTO; AMF parser не трогать. 400/401/404/409/
  422/500 — не `status:203`.
  **Цикл.** `saveDraft` (локальная Zod, optimistic `expectedVersion`) →
  `buildCandidate` (копия active entries + overlays pinned `draftVersionId`,
  состав заморожен) → `validateCandidate` (тот же `ContentValidator`,
  report persist) → `activateCandidate` (lock pointer, compatibility,
  materialize, `release_entries` на **существующие** version ids, audit).
  Validate `ok:false` не пишет release и не двигает pointer.
  **Fail-fast.** Ключ не в active release; overlay version не того ключа;
  checksum уже есть; нет token; неизвестное JSON-поле. Нет `??` на pointer.
  `composition-root` 400 строк — extract, не растить.
  **Restart / concurrency.** Draft/candidate/active переживают process
  restart. Два activate с тем же `expectedActiveReleaseId` — один winner,
  второй 409. File `playable-slice.json` не мутировать.
  Landed: `drizzle/0024_content_editor_candidates.sql`;
  `CONTENT_OPERATOR_TOKEN`; HTTP `/operator/content/*`; raw-AMF
  `tests/e2e/content-editor.test.ts`; `7179816`.
- **Acceptance:** HTTP: сменить title NPC 271, validate+activate; USE 584
  `npc|info` показывает новый title; невалидный candidate → 422 и прежний
  active; reconnect/restart читают новую release. Unit/integration на
  persist draft, report, concurrent activate. CEF Flash редактора нет
  (не OA). Product **частично**. Контракт: [CONTENT.md](../modules/CONTENT.md).
- **Status:** `done`

### EDT-02 — Extended content editor

- **ID:** `EDT-02`
- **depends_on:** `EDT-01`, `DNG-02`, `PRF-03`, `BG-01`
- **Behavior evidence:** legacy `/dev/content` screens (store/dungeon/craft/BG/
  spell/item-use) — только UX; dual-write **запрещён**. Канон: EDT-01 ports +
  [CONTENT.md](../modules/CONTENT.md). **Конфликт, не замазывать:** EDT-01 уже
  парсит все `content_type` и умеет overlay ключа из active, но документ
  оператор берёт из `playable-slice.json` (e2e NPC 271). Целевой read — active
  `release_entries` + `draft_versions`, не файл.
- **Content set:** ключи уже в playable-slice/v30, без новых ключей:
  `store_lot` `504:80` (артикул 23); `dungeon` `1` (ogre); `craft_recipe`
  `61`; `battleground` `general|2`; `artifact` `20546`; `use_script` `2827`.
- **Architecture checkpoint / decision:** complete. ADR-0017–0020 достаточны;
  новый ADR и `ARC-EDITOR` не нужны. Новых таблиц нет.
  **Владение.** Те же content ports. GET читает pinned active document, не
  catalog runtime rows и не файл. saveDraft/candidate/activate без изменения
  контракта EDT-01 (`hasReleaseEntry` остаётся: новых ключей нет).
  **HTTP.** Bearer как EDT-01. Query, не path, из-за `:` / `|` в ключах:
  `GET /operator/content/document?contentType=&contentKey=` →
  `{ document, version, draftVersionId }`;
  `GET /operator/content/keys?contentType=` → `{ keys }`. 404 если ключа нет
  в active. Тело GET нет. `*` Buffer parser не трогать.
  **Proof.** Один candidate, шесть overlays (GET→saveDraft каждого), один
  activate. Runtime OA после activate, без чтения slice-файла для document:
  `store|list` price лота 80; dungeon 1 title на существующем instance/book
  read path; recipe 61 title на `craft|user_recipes_list` (или том OA, что
  уже e2e); `arena|list` title Раскопа; 20546 title после insert в bag;
  USE-скрипт 2827 `failPlaque` на существующем fail path. `playable-slice.json`
  не менять.
  **Fail-fast.** Нет contentType/contentKey; неизвестный type; ключ не в
  active; GET без Bearer 401. `postgres-content-editor-store` 384 строки —
  extract read, не растить за 400.
  **Restart.** GET после activate/restart отдаёт новые documents. Concurrent
  как EDT-01.
  **CEF.** Flash-редактора нет. Прогон `CEF_MANUAL` Wave 0–12 **не** входит
  в этот срез. Исключение «Отложенный CEF Wave 5–12» закрыто этим close.
  Landed: GET `/operator/content/document` и `/keys`; extract
  `postgres-content-editor-read-store.ts`; raw-AMF
  `tests/e2e/content-editor-extended.test.ts`; `880daf7`. Matching
  bootstrap `seed()` возвращает pointer на bootstrap, если editor его
  сдвинул. Title recipe 61 / artifact 20546 не dump-pin (validator).
- **Acceptance:** GET document/keys без slice-файла; шесть extended types в
  одном candidate проходят draft→validate→activate; шесть OA-проверок выше;
  422 не двигает pointer; restart читает новые documents. Product **частично**.
- **Status:** `done`

## Leftover engines — механика, не сюжет

Волны 0–13 закрыты. Осталась **неперенесённая механика**, которую capability
оставили leftover. Это не CEF-backlog, не DATA-02…06 mass import и не
куратские квесты. Порядок: CMB-11 (`done`) → QST-ENG-04 (`done`) →
QST-ENG-05 (`next`, `OPEN_STORE`) → DNG-03 → TRD-02.

`CONTENT-STORY-*` не брать, пока этот блок не `done` (явный приоритет:
функционал до конца, сюжет не переносить).

CEF Wave 0–12 и ACH-01 (`deferred`) сюда не входят.

### CMB-11 — Join team 2 / intervene

- **ID:** `CMB-11`
- **depends_on:** `SOC-03`, `CMB-08`, `DNG-01`
- **Behavior evidence:** [FIGHT_JOIN.md](../../../jgr-emu/docs/FIGHT_JOIN.md);
  `jgr-emu/src/fight/lifecycle.ts` `joinFight` / `joinFightByNick`;
  `jgr-emu/src/routes/oa/helpers.ts` `helpFightError` (dump 204).
  Landed: `FIGHT_JOIN` явный `team` 1\|2; HELP = `CombatPort.participantTeam`;
  `joinHunt` сравнивает `areaId` **и** `instanceCopyId`; dungeon
  `startHunt` проставляет copy; карта occupied spawn team 1; team-2 не
  берёт бота; после смерти бота ретаргет тот же `FightDuel`; hunt EXP
  только opener-team. Leftover: N×N две дуэли сразу.
- **Content set:** без новых квестов. Hunt **50310** + копия огра **542**;
  два героя same-area / same-copy. Quest `purpose:"quest"` по-прежнему
  `HuntJoinDenied` (CMB-09).
- **Architecture checkpoint / decision:** ADR-0017–0020 достаточны; `ARC-*`
  не нужен. Active fight RAM. Combat не импортирует party/instance tables:
  composition передаёт `Hero.instanceCopyId` (`null` = мир) на
  `startHunt`/`joinHunt`. `joinHunt.team` = `1|2`; HELP читает team цели
  из того же RAM `Battle`. Карта `ATTACK_BOT` / dungeon occupied spawn
  остаётся team **1**. Party chat ACTION «ПОМОЧЬ» остаётся team **1**
  (opener охоты). Один `FightDuel` на `Battle` (не jgr N×N): team-2 joiner
  не берёт бота у team-1 waiter; после смерти бота при живом team-2 бой
  не заканчивается — тот же duel ретаргет team-1↔team-2. Одновременные
  две дуэли — leftover. Hunt EXP/лут только opener-team при победе этой
  стороны (jgr `rewardForHuman` team 1 + `wonByHero`).
  **Fail-fast.** Чужой area/copy → dump 204 «другой локации»; stale →
  «неактивный бой»; quest/duel join — текущие deny. Team 2 **не** маскировать
  под «неактивный бой».
  **Restart.** Mid-fight RAM; join после restart процесса — stale 204
  (ADR-0020).
  **CEF.** Production consumer. Product **частично** до CEF; строка
  CEF_MANUAL добавлена на close coding.
  Контракт: [COMBAT.md](../modules/COMBAT.md), [PARTY.md](../modules/PARTY.md),
  [INSTANCE.md](../modules/INSTANCE.md).
- **Acceptance:** raw-AMF: JOIN `{team:2}` и HELP на цель team 2 входят в
  тот же `fightId`; карта ATTACK_BOT на занятый 50310 по-прежнему team 1;
  две копии 542 изолируют JOIN; quest-fight join deny как сейчас; после
  смерти бота живой team-2 продолжает vs team-1; settlement без hunt EXP
  team-2; restart → 204 stale.
- **Status:** `done`

### QST-ENG-04 — Quest-fight leftovers

- **ID:** `QST-ENG-04`
- **depends_on:** `CMB-11`, `CMB-10`, `QST-ENG-03`
- **Behavior evidence:** leftover CMB-09/10 / QST-ENG-02: deny leave,
  ambush `chance` без `mode:"quest"`, QL-2 (DROP откатывает loot/deliver
  done). Не Акрилон.
- **Content set:** синтетика на NPC 271, без `q_1`. Deny leave — существующий
  `q_engine_fight` / roster. Ambush — новый `q_engine_ambush`, 503 item **1**,
  AREA `START_FIGHT` без `mode:"quest"` (бот **2**). QL-2 — loot **77**
  (`q_engine_fight` `loot_meat` или тот же artikul на hunt drop).
- **Architecture checkpoint / decision:** ADR-0017–0020 достаточны; `ARC-*`
  не нужен. Combat не импортирует quests/inventory. `leaveFight` deny —
  RAM `purpose:"quest"` **или** `instanceCopyId !== null` (тот же jgr
  `questFight || copy`); dump fproxy `{rs:false, err:"нельзя выйти из боя", sq}`,
  бой не flee. Quest `fight|conf.can_leave:0` (piggyback overlay). Outdoor hunt
  `can_leave:1`. Ambush: authored `START_FIGHT` без `mode` + `artikulId` +
  optional `chance` 0..1 (нет поля = всегда; невалидный chance — fail-fast,
  не clamp). Бой `purpose:"hunt"`; AREA bump **не** откладывается
  (`hasQuestStartFight` только `mode:"quest"`). RNG — явный `{ unit(): number }`,
  старт если `unit() < chance`. QL-2: public quests-port после DROP/SELL (и
  тот же вызов с USE/REMOVE); `value = min(limit, bagCount)`, `done` только
  при `bagCount >= limit`. Несколько текущих loot/deliver на один artikul —
  общий bag count, каждая цель независимо. `consume_at=goal_complete` нет в
  runtime — leftover. Inventory quests не импортирует.
  **Fail-fast.** leave deny не `rs:true`; chance вне [0,1] не публикуется;
  DROP без sync — запрещён для item-backed current goal.
  **Restart.** Deny leave RAM; QL-2 goals/bag PostgreSQL; ambush mid-fight RAM.
  **CEF.** Production consumer. Product **частично** до CEF.
  Контракт: [QUESTS.md](../modules/QUESTS.md), [COMBAT.md](../modules/COMBAT.md),
  [INVENTORY.md](../modules/INVENTORY.md).
  Landed: `playable-slice/v33`; deny leave / ambush / QL-2 raw-AMF.
- **Acceptance:** raw-AMF: `leaveFight` в `q_engine_fight` → `{rs:false,
err:"нельзя выйти из боя"}`, бой жив; dungeon copy — тот же deny; hunt 50310
  leave по-прежнему flee; AREA ambush без `mode:"quest"` стартует hunt-бой
  (chance 1) и бампает клик сразу; chance miss — без `fight|conf`; DROP 77 при
  loot 1/1 → done=0, повторный дроп снова нужен; quest join по-прежнему deny.
- **Status:** `done`

### QST-ENG-05 — OPEN_STORE

- **ID:** `QST-ENG-05`
- **depends_on:** `QST-ENG-04`, `ECO-01`
- **Behavior evidence:** leftover `OPEN_STORE` + `jump:"area"` в лавку
  (не телепорт `JUMP_AREA`). [STORE.md](../../../jgr-emu/docs/STORE.md)
  диалог: `{ type:"OPEN_STORE", area_id:"504" }` → `comeInArea` → закрыть
  NPC `jump:"area"`. `jgr-emu/src/quests/scripts.ts` ставит
  `openStoreAreaId` **и** `jumpArea`; `dialog.ts` зовёт `comeInArea`, на
  player-step отдаёт `withBagBookState` (`npc|answer` + bag/view/unitframe/
  book/`state`). **Не** piggyback `store|list` / `common|action` COME_IN.
  **Конфликт.** jgr `comeInArea` не проверяет `area_links`; j-emu
  `ComeInCommand` требует link. Канон этого среза — штатный ComeIn
  (overload / lock / fight / `requireLink` / `setArea` / `prepareTravel` /
  presence). 503→504 link уже в slice. `JUMP_AREA` по-прежнему только
  wire, без смены area.
- **Content set:** синтетика, не `q_5`, не Акрилон. File seed
  `playable-slice/v34`. `q_engine_store` на NPC **271**, `bookId` **8**,
  `pointId` **9**, `boardOrd` **8**. Talk `objectId` **271**, затем player
  step `OPEN_STORE` `areaId` **504**. Новых хотспотов нет (item **5** —
  дверь лавки, не занимать NPC). Восемь engine-квестов.
- **Architecture checkpoint / decision:** ADR-0017–0020 достаточны; `ARC-*`
  не нужен. `OPEN_STORE` — leftover script, как `JUMP_AREA`/`START_FIGHT`:
  quests domain не ходит в world tables. Composition `QuestDesk` в той же
  UoW, что `npc|answer`: те же ворота, что `ComeInCommand` (bag overload
  **204**, travel lock **204**, бой **203**, `requireLink` **203**
  «некуда идти»), `CharacterService.setArea` + `InstanceDesk.prepareTravel`,
  после commit — `PresenceFanout.afterMove`. Area обязана существовать и
  `code=store`; нет поля / не store / неизвестный id — fail-fast публикации
  и runtime **204**, не fallback 504. `assertStoreEntry` / COME_IN LEVEL —
  не этот срез (504 без entry requires). Quests не импортирует store
  catalog; store не импортирует quests. Миграция `quests_open_store`:
  CHECK `OPEN_STORE` + колонка `area_id` (integer, nullable); не класть
  area в `artikul_id`. Wire: `npc|answer` `{status:100, jump:"area",
macros_list:[]}` + book trio + `user|bag` + `user|view` + `user|unitframe`
  - `state` (как jgr `withBagBookState`). Клиент сам шлёт `store|list`.
    **Fail-fast.** Пустой `areaId`; area не `store`; нет link; неизвестный op
    по-прежнему 204. `JUMP_AREA` без `OPEN_STORE` area не меняет.
    **Restart.** `heroes.area_id` PostgreSQL; mid-dialog RAM нет.
    **CEF.** Production consumer. Product **частично** до CEF.
    Контракт: [QUESTS.md](../modules/QUESTS.md), [STORE.md](../modules/STORE.md),
    [WORLD.md](../modules/WORLD.md).
    Лимит 400: `quest-desk` 367, `composition-root` 382, `jugger-wire-module`
    397, `combat-service`/`battle` 400 — extract, не растить.
- **Acceptance:** raw-AMF: player `OPEN_STORE` на `q_engine_store` →
  `{jump:"area"}`, `area_id` **504**, `store|list` type `-131` лоты 23/24;
  `JUMP_AREA` без OPEN_STORE area не меняет; fight/overload/unlinked —
  текущие ComeIn deny; reconnect в 504. Quest join/leave не этот срез.
- **Status:** `next`

### DNG-03 — Instance leftovers

- **ID:** `DNG-03`
- **depends_on:** `DNG-02`, `CMB-11`
- **Behavior evidence:** leftover DNG-02: clear bar / coins,
  `personal_guaranteed` / `loot.bands`, abort fight on expiry. Не mass
  `has_clear:true` corpus (это контент).
- **Content set:** representative один `has_clear` path или существующая
  копия 542 — решить на architecture pass.
- **Architecture checkpoint / decision:** до coding — architecture pass.
- **Acceptance:** expiry/abort и clear-bar wire без JSON runtime.
- **Status:** `queued`

### TRD-02 — Persist trade session

- **ID:** `TRD-02`
- **depends_on:** `TRD-01`
- **Behavior evidence:** leftover CAPABILITIES: сессия обмена не переживает
  restart процесса.
- **Content set:** нет.
- **Architecture checkpoint / decision:** до coding — architecture pass
  (RAM vs persist; ADR-0020 может потребовать уточнения).
- **Acceptance:** restart посреди сессии не теряет put/confirm либо
  документированно рвёт обоих с dump-error, не молчаливый success.
- **Status:** `queued`

## Content-fill track — сюжет, не брать сейчас

Куратский авторский контент (Акрилон и далее) — не цель переноса (см.
`SOURCE_BOUNDARY.md`). **Не стартовать**, пока leftover-движки выше не
`done`. Эти пункты никогда не входят в `depends_on` capability волн 0–13.

`CHT-01`/`QST-01…04`/`IUS-01` из прежней версии этого документа заменены на
`QST-ENG-01`/`QST-ENG-02` (Wave 11, движок квестов) и на system-notification
часть `SOC-01` (Wave 8).

### CONTENT-STORY-01 — q_1 «Рождение скорпиона»

- **ID:** `CONTENT-STORY-01`
- **depends_on:** `QST-ENG-03`, `CMB-10`
- **Behavior evidence:** curated
  `jgr-emu/fixtures/quests_curated/q_1.json` +
  [QUEST_CURATOR_PROMPT.md](../../../jgr-emu/docs/QUEST_CURATOR_PROMPT.md) §14 +
  [QUEST_DIALOG.md](../../../jgr-emu/docs/QUEST_DIALOG.md) roster.
  **Конфликт, не замазывать:** fixture `START_FIGHT` enemies только **83**×7;
  QUEST_DIALOG / QUESTS.md — **85**×1 + **83**×7. Канон ритуала — docs/dump
  (85+83×7, allies 84/88/89/90). Kill: fixture limit **2** vs QUESTS.md
  «kill×1»; куратор уже пометил единственное vs двойное — в slice писать
  limit 2 и заметку, не подставлять 1 молча.
- **Content set:** адаптировать граф в j-emu quest document (не копировать
  nodes/edges). Ключ `q_1`, `bookId` **90002**, `flags` **32**, NPC **1617**
  (`infoId` **250**, area 503 item **11**), плита **2024** (503 item **1**,
  `active_only`), point **920011**/**920012**. Goals: talk 2024 → talk 1617 →
  kill bot **2** limit 2 → win_fight. JUMP_AREA на accept talk/kill.
  Ritual roster как QUEST_DIALOG. `onFinish` win_fight: REMOVE **9095** + MSG.
  Award: exp **25**, rep **5**/10/cap 0, artikul **478**×1. Боты
  **83/84/85/88/89/90** из `bots_overlay.json`; **478** из Pub1/artikuls.
  Publication: новые ключи через file `seed`/`playable-slice` (editor overlay
  новых ключей leftover). Не DATA-06 mass import.
- **Architecture checkpoint / decision:** complete — текущих ADR достаточно
  **после** QST-ENG-03 и CMB-10; `ARC-*` не нужен. На `QST-ENG-02` одном
  capability **не** встаёт: JUMP_AREA, boards[], talk-npc, awards.rep,
  REMOVE equipped, `startQuestFight` roster. Новый primitive снова →
  QST-ENG/CMB, не хардкод `q_1`.
  **CEF.** Flash production consumer; исключение закрыто.
- **Acceptance:** fresh hero: доска 1617 → плита 2024 → return → hunt kill×2
  Грызль **2** → ритуал 85+83×7 с союзниками → turn-in (exp/репа/478);
  9095 снята после победы; progress/награды после restart. Slice-файл не
  dual-write. CEF тот же сценарий.
  **После QST-ENG-04:** 503 item **1** занят AREA `q_engine_ambush`. Плита
  2024 не ставится на item 1, пока засада там; 271 на **4**, 272 на **8**.
- **Status:** `queued`

### CONTENT-STORY-02 — q_4 «Первое задание скорпиона»

- **ID:** `CONTENT-STORY-02`
- **depends_on:** `CONTENT-STORY-01`
- **Behavior evidence:** curated `q_4` and related hunt evidence.
- **Content set:** q_4 and its complete transitive references.
- **Acceptance:** sequential hunt kills advance and turn-in grants exactly one
  set of rewards.
- **Status:** `queued`

### CONTENT-STORY-03 — q_5 «Защита для Скорпиона»

- **ID:** `CONTENT-STORY-03`
- **depends_on:** `CONTENT-STORY-02`, `ECO-02`
- **Behavior evidence:** curated `q_5`, store 504 and equip-goal evidence.
- **Content set:** q_5, required store lots and equipment references.
- **Acceptance:** client buys and equips all required items, then turns in q_5;
  retry cannot duplicate goal credit or rewards.
- **Status:** `queued`

### CONTENT-STORY-04 — q_6 «Щегольские сапоги»

- **ID:** `CONTENT-STORY-04`
- **depends_on:** `CONTENT-STORY-03`, `CMB-07`
- **Behavior evidence:** curated `q_6`, fight loot and quest-loot evidence.
- **Content set:** q_6, target bots, loot item and limits.
- **Acceptance:** only confirmed wins grant limited quest loot; turn-in consumes
  the required quantity exactly once.
- **Status:** `queued`

### CONTENT-STORY-05 — q_7 «Лесной изгнанник»

- **ID:** `CONTENT-STORY-05`
- **depends_on:** `CONTENT-STORY-04`
- **Behavior evidence:** curated `q_7`, multi-NPC/world facts and deliver flow.
- **Content set:** q_7 and complete NPC/area/fact/item references.
- **Acceptance:** talk, travel, loot and deliver sequence completes in CEF and
  persists at each restart checkpoint.
- **Status:** `queued`

### CONTENT-STORY-06 — q_8/q_9 и далее (весь оставшийся куратский сюжет)

- **ID:** `CONTENT-STORY-06`
- **depends_on:** `CONTENT-STORY-05`
- **Behavior evidence:** curated `q_8`, `q_9`…`q_14` и связанный evidence.
- **Content set:** массовый импорт остатка `quests_curated/*.json` через
  DATA-06, не по одному квесту вручную, как раньше.
- **Acceptance:** свежий герой проходит весь доступный куратский сюжет;
  отсутствие любого из этих пунктов не блокирует ни одну capability из волн
  4–13.
- **Status:** `queued`

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
