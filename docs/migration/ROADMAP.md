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
"quest"` — `HuntJoinDenied`. Roster allies/enemies, `flags:"8"`, chat_*,
  bot↔bot, team invert, deny leave — leftover `QST-ENG-02`. Restart mid-fight
  без `on_win`/`on_lose` (нет RAM). CEF не прогоняется.
- **Acceptance:** внешний вызывающий модуль может запросить fight с
  `purpose: "quest"` и получить `on_win`/`on_lose` без изменения
  ownership terminal settlement из CMB-03.
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
  `playable-slice/v23`. POST-04 / HERO-01 leftover. Контракт:
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
- **depends_on:** `WLD-01`, `ECO-01`, `REP-01`, `INV-08`
- **Behavior evidence:** legacy `QUESTS.md`, `QUEST_DIALOG.md`,
  `QUEST_BOARD_ICONS.md`, `NPC_CATALOG.md`.
- **Content set:** 2–3 синтетических тестовых квеста (не куратский Акрилон),
  выбранных так, чтобы проверить каждый тип goal (talk/kill/loot/buy/equip/
  deliver/area_action) и каждый тип script (`START_FIGHT`, `GRANT_*`, `MSG`,
  flags, waiting AREA).
- **Architecture checkpoint / decision:** pending — persistent progress
  aggregate, typed dialog cursor, script operation registry и idempotent
  transition transaction.
- **Acceptance:** синтетические тестовые квесты проходят raw-AMF E2E и CEF на
  каждый тип goal/script; движок принимает произвольное authored quest
  definition через content pipeline, не хардкод под конкретный quest key.
- **Status:** `queued`

### QST-ENG-02 — World/combat integration hooks

- **ID:** `QST-ENG-02`
- **depends_on:** `QST-ENG-01`, `CMB-09`
- **Behavior evidence:** legacy `QUEST_DIALOG.md`, `QUEST_MAP_MARKERS.md`,
  known-bug list.
- **Content set:** без нового авторского контента — hook-проверка на
  синтетических квестах из `QST-ENG-01`.
- **Architecture checkpoint / decision:** pending — orchestration transaction
  и post-commit notifications между quest, world, inventory и combat ports.
- **Acceptance:** AREA waiting запускает нужный quest-fight через CMB-09
  hook; markers и quest-loot limits работают generic, не per-quest кодом.
- **Status:** `queued`

## Wave 12 — presentation engines

### GEAR-01 — Equipped gear spells

- **ID:** `GEAR-01`
- **depends_on:** `CMB-06`, `INV-07`
- **Behavior evidence:** legacy `GEAR_SPELL.md` и spell catalogs.
- **Content set:** один representative gear-spell.
- **Architecture checkpoint / decision:** pending — расширить combat-ready
  equipment snapshot и effect registry без смены inventory ownership.
- **Acceptance:** поддержанный equipped spell attaches/procs с точным
  packet order и истекает по authored policy.
- **Status:** `queued`

### HERO-01 — PvP heroism

- **ID:** `HERO-01`
- **depends_on:** `BG-01`, `CHR-01`
- **Behavior evidence:** legacy `HEROISM.md`; empirical formula остаётся
  `legacy behavior`.
- **Content set:** heroism bands/modifiers и presentation.
- **Architecture checkpoint / decision:** pending — PvP settlement и
  character progression ownership.
- **Acceptance:** fixed-seed PvP outcomes дают документированную величину
  один раз и отображаются в BG/fight/player stats wire.
- **Status:** `queued`

### DAY-01 — Daily quests

- **ID:** `DAY-01`
- **depends_on:** `QST-ENG-02`
- **Behavior evidence:** legacy `DAILY_QUESTS.md`.
- **Content set:** representative daily quest definition.
- **Architecture checkpoint / decision:** pending — timezone, scheduler,
  idempotency и downtime catch-up до coding.
- **Acceptance:** offer/finish/cooldown/reset переживают restart и не дают
  вторую награду внутри одного daily-периода.
- **Status:** `queued`

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
- **Behavior evidence:** legacy content UI — только UX evidence;
  [CONTENT_PIPELINE.md](../architecture/CONTENT_PIPELINE.md) authoritative.
- **Content set:** DATA-01…DATA-06 authoring schemas.
- **Architecture checkpoint / decision:** operator auth, optimistic draft
  versioning, validation report и publish/activate ports; файловый
  dual-write запрещён.
- **Acceptance:** правка создаёт новый PostgreSQL draft, неудачная валидация
  не трогает active release, успешный publish активирует атомарно и
  переживает restart.
- **Status:** `queued`

### EDT-02 — Extended content editor

- **ID:** `EDT-02`
- **depends_on:** `EDT-01`, `DNG-02`, `PRF-03`, `BG-01`
- **Behavior evidence:** соответствующие legacy editor screens и завершённые
  модульные контракты.
- **Content set:** stores, dungeons, professions, BG, spell и item-use
  authoring schemas, уже доказанные runtime.
- **Architecture checkpoint / decision:** расширяет те же draft/release
  ports; редактор не создаёт второй источник истины.
- **Acceptance:** каждый поддержанный extended content type проходит
  draft→validate→publish→activate без file mutation.
- **Status:** `queued`

## Content-fill track — не блокирует ни одну волну выше

Куратский авторский контент (Акрилон и далее) — дешёвый и легко
пересоздаваемый актив, не цель переноса (см. `SOURCE_BOUNDARY.md` §
«Цель переноса: движки, не конкретный контент»). Эти пункты берутся в любом
порядке, любым агентом, в любой момент после соответствующего движка (Wave
4–13 ниже) — они никогда не входят в `depends_on` capability из этих волн.

`CHT-01`/`QST-01…04`/`IUS-01` из прежней версии этого документа заменены на
`QST-ENG-01`/`QST-ENG-02` (Wave 11, движок квестов) и на system-notification
часть `SOC-01` (Wave 8).

### CONTENT-STORY-01 — q_1 «Рождение скорпиона»

- **ID:** `CONTENT-STORY-01`
- **depends_on:** `QST-ENG-02`
- **Behavior evidence:** curated `q_1`, related NPC/dialog/fight evidence.
- **Content set:** q_1 and its complete transitive item/bot/NPC/area/reward refs.
- **Architecture checkpoint / decision:** not required — uses the `QST-ENG-*`
  contract as-is; a new engine primitive found here returns work to `QST-ENG-*`.
- **Acceptance:** fresh hero completes talk, kill, ritual fight and turn-in;
  reward/reputation/progress survive restart.
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
