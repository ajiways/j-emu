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
- Ровно одна запись имеет статус `next`, пока в engine-треке есть следующая
  capability. После закрытия Wave 14 decoder-трека (`DATA-02`…`DATA-05`,
  `POST-02`, `POST-03`) `next` не назначается на content-fill (`CONTENT-STORY-*`,
  DATA-06).
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
  PUT_ON/PUT_OFF/DROP/SELL in fight are `requireNoActiveFight` `203` (named j-emu lock,
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
  Full L1–8 atlas — DATA-04 (закрыт).
- **Architecture checkpoint / decision:** complete — existing ADRs sufficient;
  no `ARC-WORLD`. Location stays `heroes.area_id`; add `heroes.move_ready_at`
  (NULL = free). World owns `areas` + `area_links` + `areas.parent_id`; no
  `character_locations`. OA orchestrates world `requireLink` / `linksFrom`,
  inventory `bagLoad`, character `setArea`, combat `requireNoActiveFight`. SPEED=0 in
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
  `max(2, floor(hpMax*0.05))`, clear ghost/injury, outdoor dest is temple
  **503** (temporary stub; dest graph — [WORLD.md](../modules/WORLD.md)
  leftover). Injury id **875** is a dump-proven
  wire integer; do not publish artifact 875. OA `FIGHT_JOIN`/`HELP` stay
  out. Full contract: [COMBAT.md](../modules/COMBAT.md).
- **Acceptance:** raw-AMF F5 mid-hunt: init2 has same `fightId`/`akey`,
  arena re-auths, paired hunter sees opponent and remaining turn bar
  (not `oppwait`). Restart mid-fight still no rewards/history. Loss:
  ghost persists, hp stays 0 across clock advance, roster `dead:4`;
  RESURRECT clears ghost, HP > 0, `requireNoActiveFight` unlock. CEF: F5 in Gryzl
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
  piggyback. `requireNoActiveFight` does not block `store|*`. Ghost buy is 203.
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
  `bot_spell_book.json` — DATA-03 (закрыт), не эта capability. Heal+AOE
  dump-бот (Пещерный огр 99) в каталоге DATA-03; CMB-06 не добавлял его
  в playable 503/501/504. Kind-2 heal landed. Glove kind-1 AOE landed
  (CMB-02). Bot kind-1 `targetCount>=2` в catalog, combat бьёт одну цель
  пары (leftover).
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
  до полного корпуса — DATA-03 (закрыт), не эта capability.
- **Architecture checkpoint / decision:** complete. `rollBotLoot` — чистая
  domain-функция от `BotReward` + `RandomSource`; combat/catalog не читают
  mid-roll. Произвольное число entries/весов уже в алгоритме (guaranteed
  `drop_weight=0`, weighted pool, NOTHING, bonus `2^(max-n)`). Quest/dungeon
  conditioned entries — отдельные policy-документы (CMB-09 / DNG), не
  создавать. ADR-0017–0020 достаточны, `ARC-*` нет. Не объединять с
  `pickBotSpell`.
- **Acceptance:** таблица лута работает для произвольного набора entries и
  весов: одна entry, равные веса, `nothing_weight` доминирует; Gryzl 50310
  может выдать **77** (raw-AMF). Empty tables 4/24/32 в срезе CMB-07;
  DATA-03 заполнил overlay-таблицы.
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
  живых 3↔3 пар (клон «Разозлить») landed. 3↔3 держится, пока менять некого;
  проверка после каждого удара. Invites process-local, TTL 60s через `Clock`, ключ
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
  массовый импорт `hunt_spawns.json` целиком — DATA-04 (закрыт), не эта
  capability.
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
  `has_clear: true` 4/6/7, `loot.bands`, shops — leftover POST-03.
  DNG-03 landed яму `2` (clear bar/coins) и огр `personal_guaranteed`.
  Контракт: [INSTANCE.md](../modules/INSTANCE.md).
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
  в бою layout — `requireNoActiveFight` `203` «нельзя во время боя»; блоб без
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

### EDT-03 — Operator hero console

- **ID:** `EDT-03`
- **depends_on:** `EDT-01`, `BST-01`, `CHR-01`, `INV-02`, `ECO-01`, `CMB-03`
- **Behavior evidence:** не legacy OA. Нужен operator HTTP для тестовой
  консоли (`j-content-editor` CHAR-01) и для `CEF_MANUAL` без ручного
  патча БД. ID `HERO-01` занят PvP-героизмом; это Wave 13 operator
  tooling, как EDT-01/EDT-02. Порты уже landed: `InventoryService.grantToBag`
  (CMB-03), `CharacterMoney.creditMoney` (INV-02) / `debitMoney` (ECO-01),
  `CharacterService.getById` (BST-01, `exp` CHR-01).
  `ExperienceGrantService` в этот срез **не** входит (CHAR-01 min set —
  GET / grant item / adjust gold).
- **Content set:** нет. Новых таблиц, ключей и slice bump нет.
- **Architecture checkpoint / decision:** complete. ADR-0017–0020
  достаточны; новый ADR и `ARC-*` не нужны.
  **Владение.** Character — `heroes` (money/exp/level/nick). Inventory —
  bag/pocket/paperdoll instances. Catalog — read `artifact(id)`. Новой
  таблицы нет. jugger-wire — HTTP `/operator/hero/*`, не AMF, не OA.
  Composition UoW на мутациях.
  **Auth.** Переиспользовать `CONTENT_OPERATOR_TOKEN` (обязателен в
  `loadConfig`, без default), тот же `OperatorAuthPolicy` (timing-safe
  Bearer). Отдельный `HERO_OPERATOR_TOKEN` не вводить: `operator_roles`
  нет, второй required secret без ролевой модели не изолирует
  привилегии, `/operator/*` уже одна operator-поверхность EDT-01,
  consumer (`JEMU_OPERATOR_TOKEN`) один. Разделение ролей — отдельное
  решение, не этот срез.
  **HTTP.** JSON, не AMF. Тело = существующий `*` Buffer parser →
  `JSON.parse` + DTO; AMF parser не трогать. Пути:
  `GET /operator/hero/:id` → состояние;
  `POST /operator/hero/:id/items` `{ artifactId, quantity }`;
  `POST /operator/hero/:id/money` `{ minorUnits }` (знак: `>0` credit
  `money_minor`, `<0` debit `money_minor`; `0` запрещён). Это золотые
  монеты (`money_minor` / wire `money`, `1.00` = `100` minor), не алмазы
  `money_gold_minor` (wire `money_gold`; суффикс `_gold` — имя live).
  Debit с `allowGhost: true` (operator console, не store).
  **GET DTO.** Не AMF `HeroStateBlock` / `buildUserBag`. Сборка из
  `CharacterService.getById` + `InventoryService.list` (bag / pocket /
  paperdoll). Поля: `id`, `nick`, `level`, `exp`, `moneyMinor`,
  `moneyGoldMinor` (read-only в этом срезе), списки instance
  `{ id, artifactId, quantity, durability, durabilityMax }` + `position`
  (pocket) / `slot` (paperdoll). POST успех возвращает тот же DTO.
  **Fail-fast.** Нет/неверный Bearer → 401. Невалидный JSON / неизвестное
  поле / `hero id` / `artifactId` / `quantity` / `minorUnits=0` → 400.
  Нет героя / нет артикула → 404. Bag full / недостаточно денег /
  overflow `money_minor` → 409. 422 в этом срезе нет (это validation
  report editor'а, не hero state). `grantToBag` бросает typed
  `BagFullError` / `MissingArtifactError`; голый `Error` на operator
  path не мапится по тексту, кроме already-typed character money
  (`InsufficientMoneyError`) и доменного overflow credit. 500 только
  непредвиденное, с логом.
  **Transaction.** GET — read. Grant/money — одна UoW (вложенный
  `CharacterService` UoW на том же tx). Частичный grant при bag full
  откатывается.
  **Restart.** Bag и `money_minor` PostgreSQL. **CEF.** Flash/OA
  consumer нет — internal enabling `/operator/hero/*` (исключение
  PLAYBOOK §8 «нет production wire consumer», **не** закрытое
  исключение Wave 5–12). Product **частично**.
  Контракт: [CHARACTER.md](../modules/CHARACTER.md).
- **Acceptance:** raw-HTTP e2e: GET после login; POST item 77 виден в
  bag; POST money credit/debit меняет `moneyMinor`; restart сохраняет
  оба. 401 без/неверного Bearer; 400 невалидный ввод; 404 герой и
  артикул; 409 bag full и insufficient money. Unit на mapping typed
  errors.
  Landed: HTTP `/operator/hero/:id`, `/:id/items`, `/:id/money`;
  `BagFullError` / `MissingArtifactError`; raw-HTTP
  `tests/e2e/operator-hero.test.ts`.
- **Status:** `done`

### EDT-04 — Operator catalog artifact lookup

- **ID:** `EDT-04`
- **depends_on:** `EDT-03`
- **Scope:** read-only HTTP JSON `/operator/catalog/artifacts` for the
  content-editor character console (search-as-you-type + bag titles/icons).
  Same `CONTENT_OPERATOR_TOKEN` as EDT-01/03. No new tables. Flavor
  `artikuls.description` from legacy Pub1 is **not** in `ArtifactDocument`
  and is not added here.
- **HTTP.** JSON, not AMF. Auth = `OperatorAuthPolicy`.
  `GET /operator/catalog/artifacts?q=` — up to 20 briefs, title ILIKE or
  exact numeric id; empty `q` = first 20 by id.
  `GET /operator/catalog/artifacts?ids=77,20` — preserve request order,
  omit missing ids (caller shows a placeholder). `q` and `ids` together → 400.
  Unknown query field → 400. `ids` > 64 → 400.
  `GET /operator/catalog/artifacts/:id` → one brief or 404.
  Brief: `{ id, title, picture, kindId, typeId }`. `picture` is the Pub1
  filename under `images/data/artifacts/`; static files are already served
  from `PUB1_DIR` without Bearer.
- **Fail-fast.** 401 no/wrong Bearer; 400 invalid id/query; 404 missing
  single artifact; 500 unexpected with log. Empty search is `200 { artifacts: [] }`,
  not 404.
- **CEF.** No Flash consumer — internal enabling for `j-content-editor`.
  Product **частично**.
- **Acceptance:** raw-HTTP e2e `tests/e2e/operator-catalog.test.ts`: search
  `Кусок` includes 77 (`Кусок мяса`); `q=77` includes 77; `ids=77,20` order;
  GET 77; 401; 404 missing; 400 combined q+ids / unknown field.
- **Status:** `done`

## Leftover engines — механика, не сюжет

Волны 0–13 закрыты. Сюжетный leftover не этот трек: CMB-11 (`done`) →
CMB-12 (`done`, hunt N×N две дуэли на 50310) → QST-ENG-04 (`done`) →
QST-ENG-05 (`done`, `OPEN_STORE`) → DNG-03 (`done`) → leftover TRD-02
(`done`, refund trays, не persist session).

Боевой leftover после CMB-12 — отдельная очередь `CMB-13+` ниже
(pairing → melee outcomes → magic kinds → JOIN/history/challenge).
`CMB-18` — `deferred` (ждёт продуктового решения мейнтейнера).
Engine leftover и Wave 14 закрыты. `next` на content-fill
(`CONTENT-STORY-*`, DATA-06) не назначается.

CEF Wave 0–12 и ACH-01 (`deferred`) сюда не входят. Новые production-срезы
этого трека несут CEF в acceptance (EDT-02); product **частично** до
операторского прогона.

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
  только opener-team. N×N две дуэли — CMB-12.
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
  две дуэли — CMB-12. Hunt EXP/лут только opener-team при победе этой
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

### CMB-12 — Hunt parallel duels (N×N)

- **ID:** `CMB-12`
- **depends_on:** `CMB-11`
- **Behavior evidence:** [FIGHT_MODEL.md](../../../jgr-emu/docs/FIGHT_MODEL.md);
  [FIGHT_JOIN.md](../../../jgr-emu/docs/FIGHT_JOIN.md);
  `jgr-emu/src/fight/battle.ts` `tryPairQueues` / `createCombatDuel`;
  `jgr-emu/src/fight/botAi.ts` `notifyNewDuels`. Canon: pair after any hunt
  join (docs/engine method), not the team-2 skip in `addHumanToBattle`.
- **Content set:** без нового контента. Hunt **50310**, три изолированных
  героя: opener vs bot, team-1 waiter (occupied `ATTACK_BOT`),
  `FIGHT_JOIN` `{team:2}` сразу human↔human.
- **Architecture checkpoint / decision:** ADR-0017–0020 достаточны; `ARC-*`
  не нужен. Active fight RAM. Combat не импортирует party/instance tables.
  `Battle.duels: FightDuel[]`. Unpaired living waiters team 1 vs team 2
  после `addHuman`; T1 opens. Delay token `${fightId}:${minId}:${maxId}` —
  `CombatDelay` как сейчас (dueAt + cancel), не `Clock.schedule`. Strike
  cancel только свой duel. Finish cancel все duel tokens. Смерть opener vs
  bot при живых B↔C не finish: dissolve A↔bot, бой продолжается.
  2-hero JOIN team 2 без team-1 waiter по-прежнему ждёт бота (CMB-11).
  **Fail-fast.** Нет duel у waiting striker → melee ignored, не throw.
  Нет fallback «один duel на Battle».
  **Restart.** Mid-fight RAM (ADR-0020).
  **CEF.** Production consumer. Product **частично** до CEF; строка
  CEF_MANUAL добавлена на close coding.
  Контракт: [COMBAT.md](../modules/COMBAT.md).
- **Acceptance:** raw-AMF три героя на 50310: C `FIGHT_JOIN` `{team:2}`
  сразу `oppnew` human (не только `oppwait`); B получает human `oppnew` и
  `attacknow`; A после C всё ещё бьёт Грызля (`cast`, нет `fightFinish`).
  2-hero team-2 wait + retarget после смерти бота; JOIN copy isolation 542;
  quest deny; occupied ATTACK_BOT team 1 — без регресса.
- **Status:** `done`

### CMB-13 — Hunt N×N pairing

- **ID:** `CMB-13`
- **depends_on:** `CMB-12`
- **Behavior evidence:** [FIGHT_MODEL.md](../../../jgr-emu/docs/FIGHT_MODEL.md)
  §5–6; `jgr-emu/src/fight/battle.ts` `tryPairQueues` / last-foe score;
  `jgr-emu/src/fight/swap.ts` (waiter-handoff, 3↔3 cross-swap);
  `jgr-emu/src/fight/actions/aggro.ts`; `jgr-emu/src/fight/damage.ts`
  `rollOpensFirst` (`INITIATIVE_SOFT_C=80`, skill `LUCK`);
  `jgr-emu/src/bonuses.ts` `huntAggroCharges` = `1+AGRILKA_MOBOV`.
- **Content set:** без нового контента. Hunt **50310**, два героя team 1:
  opener vs Грызль, второй `ATTACK_BOT` occupied затем «Разозлить» →
  ephemeral clone → две human↔bot дуэли; после 3↔3 обмен, HP без сброса.
  CMB-12 три героя JOIN team 2 — без регресса.
- **Architecture checkpoint / decision:** ADR-0017–0020 достаточны;
  `ARC-CMB` не нужен. Active fight RAM. Seekers = unpaired living humans
  **и** bots обеих команд; pair loop shuffle + last-foe. Occupied spawn
  bot остаётся в дуэли opener-а (CMB-12). Aggro clone только outdoor hunt
  (`purpose:"hunt"` и `instanceCopyId === null`); quest/copy/friendly —
  fury + абсолютный `persSpells`, без −1 если заряд 0. Цель — enemy bot
  id; clone id — `EphemeralBotFightIds` от `1_000_000`. Snapshot
  `CombatantFightStats` на старт/join; combat не читает character tables.
  Unpublished bot secondaries (нет LUCK в `BotDefinition`) — named policy
  initiative `0`, не STR-as-luck. Новая пара из `tryPairQueues` открывает
  `rollOpensFirst`; стартовая opener↔spawn-bot пара по-прежнему opener.
  Delay token `${fightId}:{min}:{max}`. Extract, не рост `battle.ts` /
  `combat-service.ts`. **Fail-fast.** Нет duel у waiting striker → melee
  ignored, не throw. Нет fallback «один duel на Battle».
  **Restart.** Mid-fight RAM (ADR-0020).
  **CEF.** Production consumer. Product **частично** до CEF; строка
  CEF_MANUAL на close coding.
  Контракт: [COMBAT.md](../modules/COMBAT.md).
- **Acceptance:** unit `tryPairQueues` / last-foe / aggro deny; raw-AMF
  два team-1 на 50310 + Разозлить → две human↔bot дуэли, после 3↔3
  cross-swap без сброса HP; CMB-12 JOIN team 2 и 2-hero wait без регресса;
  quest/copy aggro без клона и без −1 при 0 зарядов.
- **Status:** `done`

### CMB-14 — Melee outcomes

- **ID:** `CMB-14`
- **depends_on:** `CMB-13`
- **Behavior evidence:** [FIGHT_DAMAGE.md](../../../jgr-emu/docs/FIGHT_DAMAGE.md)
  invented; `jgr-emu/src/fight/damage.ts` `rollMeleeOutcome`. Swing:
  dodge → block → crit → DEF → HP. Knobs `COMBAT_SOFT_C=600`, cap 0.40,
  crit×2.35, block 450/0.33 на named `BattleRules`, метка `legacy
behavior`. Wire `react` 1/2/6/10/14. Fatality/казнь — не этот срез
  (FIGHT_RAGE OPEN). RAG/DEX/DEF/BLOK/LUCK в snapshot на старт.
- **Content set:** голый L1 vs Грызль 50310; representative dodge/block/crit
  через unit RNG, не новый контент.
- **Architecture checkpoint / decision:** ADR-0017–0020 достаточны;
  `ARC-CMB` не нужен. Combat не читает character tables mid-fight.
  **Restart.** Mid-fight RAM. **CEF.** Production consumer; product
  **частично** до CEF.
  Контракт: [COMBAT.md](../modules/COMBAT.md).
- **Acceptance:** unit swing order + react codes; raw-AMF hunt 50310
  по-прежнему завершается; CMB-13 pairing без регресса.
- **Status:** `done`

### CMB-15a — Instant kind-1 magic

- **ID:** `CMB-15a`
- **depends_on:** `CMB-14`
- **Behavior evidence:** [FIGHT_MAGIC.md](../../../jgr-emu/docs/FIGHT_MAGIC.md),
  [BOT_SPELLS.md](../../../jgr-emu/docs/BOT_SPELLS.md) invented;
  `rollMagicHit`; магия не критует. Snapshot MAGSTR/MAGRES на старт.
  Hissa 396/50101 уже kind-1 без школ — выровнять формулу.
- **Architecture checkpoint / decision:** ADR-0017–0020; `ARC-CMB` не
  нужен. **CEF.** Production consumer; product **частично** до CEF.
- **Acceptance:** Hissa 50101 instant kind-1 с MAGRES; Грызль melee-only.
- **Status:** `done`

### CMB-15b — Kind-1 charging overlay

- **ID:** `CMB-15b`
- **depends_on:** `CMB-15a`
- **Behavior evidence:** FIGHT_MAGIC charging overlay: melee физика +
  второе `hpChange` школы, в том числе после dodge/block. Representative:
  Hissa 397 / перчатка 181.
- **Architecture checkpoint / decision:** ADR-0017–0020; `ARC-CMB` не
  нужен. **CEF.** Product **частично** до CEF.
- **Acceptance:** charging overlay после melee, в том числе dodge/block.
- **Status:** `done`

### CMB-15c — Remaining magic kinds

- **ID:** `CMB-15c`
- **depends_on:** `CMB-15b`
- **Behavior evidence:** kind 3 charging/attack-curse; kind 4/5 ticks
  (бюджет `duration/period`, sibling `hpChange`, known DoT-kill as
  physics); kind 8/11; kind 10 summon; kind 18 stun; gate
  `foe_has_dispel_groups`. Kind-2 heal уже CMB-06. Summon — dump-bot с
  `fight_start` 632 если есть в DATA-03.
- **Architecture checkpoint / decision:** ADR-0017–0020; `ARC-CMB` не
  нужен. **CEF.** Product **частично** до CEF.
- **Acceptance:** representative Hissa 397 overlay path + хотя бы один
  kind 4/5 tick и gate dispel; summon если 632 в DATA-03, иначе явный
  skip в контракте.
- **Status:** `done`

### CMB-16 — BG FIGHT_JOIN

- **ID:** `CMB-16`
- **depends_on:** `CMB-15c`, `CMB-11`, `BG-01`
- **Behavior evidence:** [FIGHT_JOIN.md](../../../jgr-emu/docs/FIGHT_JOIN.md)
  на живой Раскоп. CMB-11 и BG-01 landed; срез не входил в close CMB-13..15c.
- **Architecture checkpoint / decision:** ~~ADR-0017–0020 достаточны; `ARC-CMB`
  не нужен. Не выделять `FightRules` (CMB-18).~~ **Отменено:** `ARC-CMB`
  поднят, `FightRules` выделен на его шаге 3. Combat battleground не
  импортирует: `startPvp` принимает `instanceCopyId` и `fightFlags` с
  composition (BG-01 runtime). `joinHunt` пускает `kind:"pvp"` при том же
  `areaId`/`instanceCopyId`; `kind:"friendly-duel"` остаётся deny «нельзя
  вмешаться в дуэль»; quest — CMB-09. Pairing — существующий
  `pairHuntQueues` (seekers = waiting humans; стартовая 1v1 PvP-пара не
  seeker). JOIN `fight|conf` в PvP — `pvpConfiguration` (`is_pvp:1`,
  `type:"1"`, `can_leave:1`, `instance_id` и flags с боя). Leave в PvP
  copy разрешён (`can_leave:1`); dungeon hunt copy по-прежнему deny.
  Active fight RAM (ADR-0020). **Fail-fast.** Copy mismatch dump 204.
  **Restart.** JOIN после restart — stale 204. **CEF.** Product
  **частично** до CEF. Контракт: [COMBAT.md](../modules/COMBAT.md),
  [BATTLEGROUND.md](../modules/BATTLEGROUND.md).
- **Acceptance:** raw-AMF третий и четвёртый герои в той же копии Раскопа:
  `FIGHT_JOIN`/`FIGHT_HELP` в живой PvP `fightId`; `fight|conf` как ATTACK
  (`is_pvp:1`, `type:"1"`, `can_leave:1`, тот же `instance_id`/`flags`);
  C JOIN `{team:1}` ждёт, D JOIN `{team:2}` сразу vs C; A↔B продолжают;
  world JOIN — 204 другая локация; friendly JOIN — дуэль; restart —
  204 stale.
- **Status:** `done`

### CMB-17 — Practice fight history

- **ID:** `CMB-17`
- **depends_on:** `CMB-16`
- **Behavior evidence:** OA `arena|finished_fights` / type 6 practice
  history. Mapper `finished_fights` уже есть; OA нет.
- **Architecture checkpoint / decision:** ~~ADR-0017–0020 достаточны;
  `ARC-CMB` не нужен. Не выделять `FightRules` (CMB-18).~~ **Отменено:**
  `ARC-CMB` поднят, `FightRules` выделен на его шаге 3. Combat владеет
  `combat.finished_fights`; jugger-wire не читает таблицу напрямую.
  OA `arena|finished_fights` — отдельная команда, не `BattlegroundDesk`
  (`arena|bg_finished` остаётся историей матчей Раскопа). Список —
  текущий `hero.areaId`, не только свои бои; фильтры nick / type /
  level_min / level_max / page; PAGE_SIZE 10; `page` в ответе 0-based.
  Retention 72h в SELECT (`finished_at > now-72h`); prune **не** на
  request path (`FinishedFightCleanup` batches). Practice recorder пишет
  `type:6`, teams 1v1 human↔human; hunt `type:1` human↔bot без изменений.
  PvP/quest history как отдельный leftover не смешивать: quest уже hunt
  kind; PvP в этом срезе не пишется. Active fight RAM (ADR-0020).
  Landed leftover (без нового ID): OA `arena|runned_fights` из RAM;
  тестовый GET `/fight_info.php` (RAM, иначе 72h history). Live chrome
  карточки и PvP type 1 history — всё ещё leftover.
  **Fail-fast.** Невалидный form integer — 203. **Restart.** History
  PostgreSQL переживает процесс. **CEF.** Product **частично** до CEF.
  Контракт: [COMBAT.md](../modules/COMBAT.md).
- **Acceptance:** raw-AMF после friendly duel в 503: `arena|finished_fights`
  содержит `type:6` с обоими никами и `me`; фильтр `type:6`; другая
  area — пусто; restart — строка на месте. Hunt type 1 на той же доске.
- **Status:** `done`

### ARC-CMB — единая модель боя (`FightRules` + `startBattle`)

- **ID:** `ARC-CMB`
- **depends_on:** `CMB-17`
- **Behavior evidence:** [FIGHT_MODEL.md](../../../jgr-emu/docs/FIGHT_MODEL.md)
  § «Bootstrap и правила боя»: движок — blackbox, ему достаточно roster
  team A / team B и правил последствий; `startFight` и `startFriendlyDuel`
  «**не два движка**»; арена 5v5 и human↔human нападение «**не** требуют
  отдельного combat-engine»; новые режимы добавляются адаптером, но
  «**не ветвить физику боя**». Целевая форма названа там же: `FightRules` +
  `startBattle({ team1, team2, rules })`.
- **Триггеры из FIGHT_MODEL сработали оба.** `FightRules` — «третий режим
  последствий»: в j-emu их четыре (hunt, quest, friendly-practice, pvp;
  `HuntFightSettlement.persistFinished` ветвится на три). Общий
  `startBattle` — «арена N×N или несколько новых стартов подряд»: N×N
  приземлён (CMB-12/CMB-13), точек старта три (`startHunt`,
  `startFriendlyDuel`, `startPvp`) плюс BG. Ранее отложено осознанно:
  checkpoint CMB-14/CMB-15a–c, затем CMB-16/CMB-17 «Не выделять
  `FightRules`», а сам триггер припаркован на продуктовое решение CMB-18.
  Архитектурное давление пришло не из CMB-18, а из уже закрытых
  CMB-11…CMB-17 и quest roster — поэтому ARC поднимается отдельно от
  продуктового вопроса про outdoor challenge.
- **Current data flow:** «кто в бою» описано **тремя** несовместимыми
  формами: `HuntBattleInit` (плоские `hero*` + плоские `bot*` + приделанные
  `extraEnemies[]` / `allies[]`), `FriendlyDuelBattleInit`
  (`challenger` / `acceptor`), `HuntJoinHuman` (добор).
  `seedBattleParticipants` ветвится на первом шаге и производит
  структурно разные бои; `Battle.huntRoster` имеет тип
  `HuntRoster | null` (47 ссылок на roster в combat); участники — два
  класса без общего интерфейса (`HuntHuman`, `HuntRosterBot`), склеенные
  union `MeleeTarget` `kind:"human"|"bot"`, который протёк в таргетинг,
  pairing, aggro и fanout. Ветвлений на `kind`/`purpose` — 36 по
  combat + app. `huntFightOpenerTeam` / `huntFightEnemyTeam` выводят
  **номер команды из `purpose`**. Физика уже ветвится, вопреки
  FIGHT_MODEL: `battle-hunt-actions.ts` бросает «Human duel has no bot to
  take a turn», то есть AI-участник в дуэли невыразим; по той же причине
  aggro-клон ограничен `kind==="hunt" && purpose==="hunt"`, а bot summon
  (kind 10) возвращает `[]`.
- **Target data flow:** `Battle(meta, participants, rules, random)`.
  `participants` — плоский список `Combatant` (`id`, `team`,
  `controller:"human"|"ai"`, статы, effects); движок на ходу смотрит на
  `controller`: human ждёт команду или таймаут, ai зовёт выбор действия.
  `FightRules` — named versioned policy (`canJoin`, `canLeave`, `canAggro`,
  `shuffleAfterHits`, `teamAssignment`, `lootMode`, `restoreAfter`), как
  разрешает AGENTS.md. Тип боя выживает только как `meta.kind` и читается
  вне движка ровно тремя местами: settlement (последствия), wire
  (`type` `"6"`/`"1"`), join/leave policy. Адаптеры мира
  (`createHuntBattle`, `startHumanDuelBattle`, BG, quest roster) остаются
  тонкими мапперами в `FightSetup`.
- **Что переносить не нужно:** нижний слой уже generic и не трогается —
  `HuntHumanFightEffects` общий для `HuntHuman` и `HuntRosterBot`,
  `rollMeleeOutcome` работает на структурном `StrikeStats`, `FightDuel` —
  на числовых id. Урон, эффекты, magic, pacing ходов и `BattleRules` вне
  объёма.
- **Порядок миграции:** (1) **landed** — `Combatant` (`id`, `team`, `maxHp`,
  `mag`, `strikeStats`) как общая read-поверхность обоих вариантов
  `MeleeTarget`, фабрики `humanMeleeTarget` / `botMeleeTarget`; (2) **landed** —
  write-модель hp: удар человека по боту мутирует живой `HuntRosterBot`;
  `BotMeleePresence` / `hitBot` / `presences` / `applyPresence` удалены.
  `alive` входит в `Combatant`, `hp` — нет: живой hp читается только через
  `targetHp`, чтобы устаревшая копия не конкурировала с живым значением.
  `enemySideCleared` принимает один список участников; (3) **landed** —
  `FightRules` как обязательная versioned policy на старте боя:
  `teamAssignment` вместо `huntFightOpenerTeam`/`hunt-fight-teams.ts`,
  `skipQuestKills` печётся из стартового `botCount` (квест 1 бот кредитует
  киллы, несколько — нет). Решения join/leave/aggro/shuffle/bot-turns/history
  /wire type читают правило, не `kind`/`purpose`. `Battle.purpose` остаётся
  meta; (4) **landed** — единый `FightSetup { meta, teams }`, три init-формы
  сводятся к нему, builders становятся адаптерами; (5) **landed** — один
  движок паринга и один цикл ходов на всех участников независимо от
  контроллера: все `FightDuel` в `Battle.duels`, очередь `waiting` общая,
  AI-ход через `resolveAiActorTurn`; (6) **landed** — снять `huntRoster: HuntRoster | null` — мобы живут в общем списке
  участников; (7) **landed** — удалить `kind`/`purpose` ветвления из domain, оставив
  `meta.kind` для settlement/wire. Каждый шаг — отдельный коммит, зелёный
  gate и существующие e2e.
- **Согласовано с мейнтейнером (2026-09-18):** очередь шла по шагам этой
  записи. Шаг 7 закрыт: `Battle.kind` / `battleKindOf` сняты, `meta.kind`
  остаётся для settlement и `wireFightTypeOf`. Перф-долг боевки из
  [COMBAT.md](../modules/COMBAT.md) § «Инженерный долг» в `ARC-CMB` не входит
  и берётся отдельно.
- **Найдено на шаге 1 (меняет порядок):** hp нельзя было слить вместе с
  остальными полями. `tryPairedMelee` читает hp человека **после**
  применения урона (живой объект) и hp бота — из снапшота **до** применения;
  снапшот hp в общий тип менял бы расчёт добивания и overlay-догоняющего
  удара. Поэтому unification hp вынесена в отдельный шаг 2 перед
  `FightRules`, а не входит в шаг 1.
- **Найдено на шаге 2:** прямая мутация бота уже была в
  `resolveRosterBotTurn` и `resolveBotTurn`; снапшот был исключением одного
  пути. Overlay и react-kill читают живой hp через `targetHp` после
  основного удара. `Combatant.hp` сначала завели копией на wrap, затем
  убрали: его не читал никто, а копия отдавала hp **до** удара — тот же
  класс дефекта, что снятый снапшот, только отложенный. Единственный ридер
  hp — `targetHp`. `HuntRosterBot.setHp` оставлен: heal в `bot-spell-act` и
  запись после хода бота в `applyBattleBotMelee`.
- **Найдено на шаге 3:** `skipQuestKills` нельзя было свернуть в
  `purpose !== "quest"`: 1v1 квест (opener team 2, один бот) киллы **кредитует**;
  skip только при `botCount > 1`. Квест не клонирует через aggro, поэтому
  стартовый count равен былому live `HuntRoster.bots.length`. `canLeave` и
  `canAggro` пекут `instanceCopyId` на старте (hunt в копии — нельзя), а не
  читают purpose mid-fight. Join — не boolean: `hunt-roster` / `pvp-humans` /
  `denied`+причина. Shuffle выключен у quest, `pairsNextWaiter` у quest
  включён (это был `kind === "hunt"`). Шаг 6 больше не зависит от roster для
  skipQuestKills. `BattleRules` не переименовывали: это тюнинг, не policy.
- **Найдено на шаге 3 (ревью):** `hasBotTurns` / `resultTitleFromBot` /
  `includesBotIdInNotice` / условие `historyRow==="hunt-bot"` имели одну
  truth-таблицу — это один факт `hasEnemyBots`, не четыре переключателя.
  `historyRow` остаётся трёхзначным (`hunt-bot` / `practice-humans` / `none`),
  но `"hunt-bot"` выводится из `hasEnemyBots`. `pairsNextWaiter` совпал по
  значению, но это механика очереди (у quest join запрещён, значение
  ненаблюдаемо); оставлен отдельным полем. `wireFightType` убран из policy:
  строка `"6"`/`"1"` собирается на границе ответа из `meta.kind`, как говорит
  target data flow. Имя `FightRules` в прозе уже занимал боевой lock `203`;
  lock в документации переименован в `requireNoActiveFight` (имя функции в
  `src`), класс policy не трогали.
- **Найдено на шаге 4:** внешность человека сведена к
  `HuntHumanAppearance {avatar,body,sk}`; у бота те же три поля остаются на
  `HuntRosterBotSeed`. Join больше не третья identity-форма: `FightSetupJoin`
  = human + `team` + `startedAtMs` с часов на join (`Date.getTime()`), не
  `meta.startedAt`. `Battle.kind` трёхзначный (`quest`→`hunt`) оставлен как
  alias для `wireFightTypeOf`; `Battle.purpose` = `meta.kind` и те же строки
  уходят в `FightFinishedNotice` / `quest-desk`. Шаги 5–7 не сдвигаются:
  `seedBattleParticipants` по-прежнему отдаёт `huntRoster`.
- **Найдено при разборе roster (меняет порядок):** `HuntRoster` — не одна
  абстракция, а четыре обязанности в одном классе: контейнер ботов
  (`bots`, `primary`, `snaps`, `findBot`), очередь паринга
  (`waitingEnemies`, `takeNextEnemyForHuman`, `occupy`, `unpairedLiving`),
  второй цикл ходов (`extraDuels`, `tick`) и вывод команд с квестовым
  правилом из `purpose` (`openerTeam`, `skipQuestKills`). Контейнер снимается
  тривиально, а паринг и цикл ходов существуют **дважды**, разрезанные по
  типу контроллера: люди паруются через `HuntHuman.waiting` / `pair` и
  `livingWaiterOnTeam`, боты — через roster; дуэли бот↔бот тикаются отдельно
  от дуэлей с людьми. Поэтому унификация паринга и цикла ходов выделена в
  отдельный шаг 5 перед снятием `huntRoster`, иначе удалять класс нечего.
  Нужная форма уже есть и работает: `HuntSeeker` в `try-pair-hunt-queues`
  приводит человека и бота к одинаковому
  `{ id, team, lastOpponentId, initiative }` и лазит лишь в два контейнера,
  а `Combatant.alive` из шага 2 — тот предикат живости, который `huntSeekers`
  сейчас дублирует вручную для людей и ботов.
- **Найдено на шаге 5:** конструктор quest leftover парует ally↔enemy без
  `rollOpensFirst` (opener всегда союзник). Это не баг относительно jgr;
  семантика сохранена в `pairLeftoverRosterBots` на сиде и **не** свёрнута
  в `pickHuntPair`. `keepFightOnKill: true` у bot↔bot нельзя слить с
  человеческим путём: `actBotSpellCard` иначе эмитит fight-finished на
  смерть моба в extra-дуэли; у бота→человека флаг считается по живым
  тиммейтам цели. Планировщик один (`resolveAiActorTurn`), момент вызова
  разный: bot↔bot тикается сразу после человеческого удара, bot→человек
  с `meleeBotCounterMs` — иначе сдвинется wire. `HuntRoster.enemySideCleared`
  остался контейнерным предикатом только по ботам roster; quest-tick
  по-прежнему берёт `enemySideCleared` из списка `Combatant`. Шаги 6–7 не
  сдвигаются: контейнер (`bots`, `primary`, `snaps`, `findBot`, aggro-clone)
  и nullable `huntRoster` снимаются на шаге 6.
- **Найдено на шаге 6:** authenticate отличал дуэль от охоты только по
  `huntRoster === null`. После снятия контейнера это `FightRules.hasEnemyBots`
  (пустой `Battle.bots` на сиде, потому что правило false), не
  `kind`/`purpose` и не «забыли передать ботов». Primary на wire — первый
  AI с `team === enemyTeam`, не `bots[0]`. Имя join-mode `hunt-roster`
  остаётся label policy, не удалённый класс. Шаг 7 не сдвигается: ветвления
  `kind`/`purpose` в domain ещё есть, authenticate в их число больше не
  входит.
- **Найдено на шаге 7:** `Battle.questChat` ветвился на `meta.kind` hunt|quest,
  а `FightRules.includesQuestChat` true только у quest. Notice уже шёл по
  правилу, поэтому hunt на wire не отдавал chat. После замены ветки правилом
  hunt `questChat()` бросает; quest по-прежнему отдаёт строки. `wireFightTypeOf`
  принимает четыре `FightKind`: quest не throw, даёт `"1"`. `Battle.purpose`
  оставлен тонким alias `meta.kind` для `FightStart` / notice. `requireMeta`
  остаётся проверкой документа setup на старте.
- **Совместимость wire и данных:** миграции схемы и backfill **не
  требуются** — active fight существует только в RAM (ADR-0020), таблиц
  боя нет, форма строки `combat.finished_fights` не меняется. Wire не
  меняется: `fight|conf`, `persList`, `cast`, `fight|exit` собираются
  мапперами из тех же снапшотов. Restart-риска нет по той же причине:
  активные бои и так не переживают процесс.
- **Rollback:** каждый шаг — внутренний refactor за `CombatPort`, откат
  ревертом коммита; dual-path и compatibility-флагов не вводить.
- **Acceptance:** существующие e2e боя (hunt, join/intervene, N×N,
  friendly duel, PvP/BG, quest roster, reconnect, restart) проходят без
  правок ожиданий; unit `resolve-ai-actor-turn` гоняет AI-ход по
  `Battle.duels` без контейнера `HuntRoster`; в `src/modules/combat`
  не остаётся ветвлений на `kind`/`purpose` вне `meta` и wire-маппера;
  `npm run check` зелёный.
- **Разблокирует:** CMB-18 (outdoor challenge — уже без архитектурной
  части), арена / 5v5, новые BG-карты, bot summon kind 10 и aggro вне
  outdoor hunt, расширения quest roster.
- **Status:** `done`

### CMB-18 — Outdoor ATTACK challenge

- **ID:** `CMB-18`
- **depends_on:** `CMB-17`, `ARC-CMB`
- **Behavior evidence:** leftover дока, не рабочий jgr runtime (`ATTACK`
  по нику идёт только в Раскоп). **Только после явного решения:** третий
  режим последствий → тогда `FightRules` + `startBattle({team1,team2,rules})`
  по FIGHT_MODEL. Не изобретать outdoor challenge из mapper-а.
- **Architecture checkpoint / decision:** архитектурная часть вынесена в
  `ARC-CMB`; сама capability остаётся блокирована продуктовым решением,
  не coding.
- **Status:** `deferred` — ждёт продуктового решения от мейнтейнера
  (не coding; не изобретать outdoor ATTACK challenge).

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
  area в `artikul_id`. Wire этого `npc|answer` (jgr `withBagBookState`):
  `{status:100, jump:"area", macros_list:[]}` + book trio + `user|bag` +
  `user|view` + `user|unitframe` + `state`. Клиент сам шлёт `store|list`.
  **Fail-fast.** Пустой `areaId`; area не `store`; нет link; неизвестный op
  по-прежнему 204. `JUMP_AREA` без `OPEN_STORE` area не меняет.
  **Restart.** `heroes.area_id` PostgreSQL; mid-dialog RAM нет.
  **CEF.** Production consumer. Product **частично** до CEF.
  Контракт: [QUESTS.md](../modules/QUESTS.md), [STORE.md](../modules/STORE.md),
  [WORLD.md](../modules/WORLD.md).
  Лимит 400: extract `come-in-travel` / `quest-answer-wire` / `quest-area-oa`;
  `composition-root` / `jugger-wire-module` / combat не растить.
- **Acceptance:** raw-AMF: player `OPEN_STORE` на `q_engine_store` →
  `{jump:"area"}`, `area_id` **504**, `store|list` type `-131` лоты 23/24;
  `JUMP_AREA` без OPEN_STORE area не меняет; fight/overload/unlinked —
  текущие ComeIn deny; reconnect в 504. Quest join/leave не этот срез.
  Landed: `playable-slice/v34`; `0026_quests_open_store`; raw-AMF
  `tests/e2e/quest-engine-05.test.ts`. CEF не прогонялся.
- **Status:** `done`

### DNG-03 — Instance leftovers

- **ID:** `DNG-03`
- **depends_on:** `DNG-02`, `CMB-11`
- **Behavior evidence:** leftover DNG-02: clear bar / coins,
  `personal_guaranteed`. [DUNGEON.md](../../../jgr-emu/docs/DUNGEON.md)
  § Clear progress; `jgr-emu/src/dungeon/clear.ts` `pushInstanceConf`;
  `loot.ts` `collectDungeonLoot`. Огр dump: `has_clear: false`,
  `instance_conf` без `progress_*`, `loot.personal_guaranteed` **2371**.
  Яма dump `giga-run-npcs-dungeons.chlz`: artikul **2**,
  `progress_finish_value=7`, вход 510 `flags:256` → 544.
  `poganaya_yama.json`: 6 trash `544_*` (108+109×4) + boss `boss`
  (106+107×5), `clear.coin_artikul_id` **5986** max 26 min 1.
  **Конфликт.** jgr kick: «TODO: abort fight» — в бою только
  `pendingKick`, kick после `finish`. Dump abort нет. Этот срез **не**
  abort; `pending_kick` уже landed. `loot.bands` огра — leftover, не
  авторить. Формула монет jgr **invented** (`round(coin_max×progress/finish)`);
  канон среза — тот же, не выдумывать другую.
- **Content set:** не mass POST-03. File seed `playable-slice/v35`.
  1. **Поганая яма** artikul **2**, area **544**, parent **510** (isolated:
     dump parent 510→508 не импортировать; `parent_id` пустой, как 541).
     Дверь 510 item **14** → 544 `flags:256`; выход 544 item **3** → 510
     `flags:2048`. Spawn list dump-faithful (7). `hasClear: true`,
     `progressFinishValue: 7`, `clear` 5986/1/26, `loot.personal_guaranteed`
     `[]`, `loot.boss_bot_id` **106**. Боты **106/107/108/109** из
     `bestiary_bots.json` (level/VIT/STR/LUCK/exp/money/hunt); `spellBook`
     пустая как 353/354/373. **Конфликт:** bestiary 106 `effect_ids` — не
     этот срез. Artifact **5986** «Монета Поганой ямы» из Pub1/dump; нет
     строки — candidate fail, не skip coins. Shop **830**, hunts/NPC 510 —
     leftover. 2) Огр artikul **1**: `loot.personal_guaranteed: [2371]`
     (2371 уже в slice). `hasClear` false, bands не писать.
- **Architecture checkpoint / decision:** ADR-0016/0018/0020 достаточны;
  `ARC-INS` не нужен; abort≠pending_kick ADR не создавать. Catalog владеет
  definition (`hasClear`, finish, coins, personal ids). Instance владеет
  killed keys и считает bar (чистые функции, как jgr `clear.ts`). Combat
  не импортирует instance: spawn для grant — peek `DungeonHuntWorld`
  fight→copy/spawn **до** `releaseFight`. Inventory грантит coins/2371
  `personal_only` каждому team-1 в том же UoW, что `HuntFightSettlement`
  (не только top damager). World loot/EXP — CMB-07 как сейчас.
  `markSpawnKilled` остаётся в `InstanceHuntLockRelease` (idempotent).
  esrv `instance_conf` на enter / floor travel / progress tick (team-1
  боя). Миграция `catalog_dungeon_clear`: nullable finish + coin trio
  (все три или все null) + `loot_boss_bot_id`; таблица
  `dungeon_personal_guaranteed`. Не jsonb bands.
  **Fail-fast.** `hasClear` без clearable spawn / finish 0; coin/personal
  artikul нет в catalog; `hasClear: false` с `progress_*` в document;
  `instanceConf(hasClear)` без finish/value; missing dungeon 204.
  Level < `levelMin` — текущий 204. Abort mid-fight не делать.
  **Clock/RNG/ID.** Bar/coins детерминированы (killed keys + формула);
  bands RNG не этот срез. Copy/item id — PostgreSQL. Sweep TTL — тот же
  `DelayScheduler` 15s.
  **Restart.** `killed_spawns` PostgreSQL; `instance_conf` на COME_IN
  пересобирается из keys. Mid-fight RAM; `pending_kick` после finish.
  **CEF.** Production consumer. Product **частично** до CEF. Яма L11 —
  e2e выдаёт EXP, не занижает `levelMin`.
  Контракт: [INSTANCE.md](../modules/INSTANCE.md),
  [COMBAT.md](../modules/COMBAT.md).
  Лимит 400: extract clear-progress (instance domain) и dungeon personal
  grant (app composition) из `hunt-fight-settlement` (337) /
  `instance-desk` (240); `composition-root` (379) / `jugger-wire-module`
  (392) / `combat-service` (371) / `battle` (368) не растить ради spawn
  key на snapshot.
- **Acceptance:** raw-AMF: L11+ 510→544 `instance_conf`
  `{artikul_id:"2", progress_finish_value:"7", progress_value:0, status:100}`;
  огр 542 по-прежнему без `progress_*`; win одного `544_*` → esrv
  `progress_value:1`, spawn в `killed_spawns`, reconnect; win boss ямы →
  bag 5986 count = формула от текущего progress, `personal_only`, в
  `fight|loot` этого team-1; win огра → 2371×1 каждому team-1; TTL в бою
  не abort (pending_kick после finish). Level<11 — 204. Shop 830 / bands
  / abort / данжи 4/6/7 — не этот срез.
  Landed: `playable-slice/v35`; `0027_catalog_dungeon_clear`; raw-AMF
  `tests/e2e/dungeon-clear.test.ts`. CEF не прогонялся.
- **Status:** `done`

### TRD-02 — Restart refund trays

- **ID:** `TRD-02` (leftover; не wave «Direct trade settlement», тот `done`)
- **depends_on:** `TRD-01`
- **Behavior evidence:** CAPABILITIES leftover: сессия не переживает
  restart. jgr [TRADE.md](../../../jgr-emu/docs/TRADE.md): сессия
  in-process; `put` снимает bag; после краша вещи теряются, «пока не
  будет persist». Live OA dump окна после restart процесса нет.
  **Решение среза (замок):** сессию **не** persist. Нужен только возврат
  вещей обоим. Деньги на столе не списаны — уже на герое.
- **Content set:** нет.
- **Architecture checkpoint / decision:** ADR-0017–0020 достаточны;
  `ARC-ECO` / новый ADR не нужны. ADR-0020 про бой; trade-окно остаётся
  RAM как hunt overlay. Escrow — custody снятых `items`, как mail
  snapshot, не restore UI.
  Таблица `trade.held_items`: identity id с 1; `hero_id` FK heroes;
  колонки снимка как `mail.letter_attachments` (original_item_id,
  artifact_id, quantity, durability*, upgrade_*), не JSONB. PK id;
  lookup `(hero_id, original_item_id)` уникален (стек на столе мержится
  как RAM map).
  Composition: `put` take+insert escrow одна UoW (сейчас take commit, RAM
  после — дыра при краше). `withdraw`/`decline`/settle grant/transfer +
  delete escrow та же UoW. Serial gate TRD-01 без изменений.
  Старт `Application`: refund всех строк `grantMailSnapshots` (новый
  `items.id`), delete только после успеха. Bag full — оставить строку,
  не mail, не silent drop. RAM `TradeSessions` с нуля: нет окна, нет
  restore `trade|session`. F5 в том же процессе — по-прежнему RAM.
  **Fail-fast.** Withdraw/settle RAM-слот без escrow — 204, не пустой 100. После restart `trade|*` без сессии — текущий 203 «нет сессии
  обмена». Не выдумывать chat «обмен прерван».
  **Clock/RNG/ID.** Нет. Escrow id — PostgreSQL identity. Tray id —
  process counter с 1, как сейчас.
  **Restart.** Вещи обоих в bag; pledged money на герое; окна нет.
  **CEF.** Production consumer. Product **частично** до CEF.
  Контракт: [TRADE.md](../modules/TRADE.md).
  Лимит 400: `inventory-service` ~395, `composition-root` ~359,
  `trade-desk` ~90 — extract `trade-held-refund` в app; escrow repo в
  `trade`; не растить inventory-service / combat / jugger-wire.
- **Acceptance:** raw-AMF два героя, оба `put` dump-предмет (например
  9095/77), `harness.restart()`, init: bag содержит те же artikul
  (новый `items.id` ок), money не списан, `trade|session` нет; повторный
  `put`/`confirm` без новой сессии — 203 «нет сессии обмена». Live F5
  без restart процесса окно не рвёт. Settle/decline по-прежнему не
  дублируют вещи. Wave settlement/tax не этот срез.
  Landed: `drizzle/0028_trade_held_items.sql`; `src/app/trade-held-refund.ts`;
  `src/modules/trade` escrow repo; raw-AMF `tests/e2e/trade.test.ts`.
  CEF не прогонялся.
- **Status:** `done`

## Wave 14 — content corpus decoders

Приоритет `CONTENT_MATRIX.md` § «Приоритет: тянуть DATA-стадии за
движком, не откладывать»: как только домен механики стал generic, полный
импорт его Pub1-корпуса — следующая задача, не отдельная поздняя волна.
Это generalized per-domain decoder tooling, не куратский контент —
`CONTENT-STORY-*` ниже остаётся `queued` и не входит в `depends_on` ни
одной записи этой волны. После POST-03 dungeon corpus decoder-трек закрыт:
`next` на этой волне больше нет.

### DATA-02 — Pub1 item corpus decoder

- **ID:** `DATA-02`
- **depends_on:** `FND-01`
- **Behavior evidence:** [CONTENT_MATRIX.md](CONTENT_MATRIX.md) § DATA-02
  rows; `jgr-emu/src/db/seed_artifacts.ts` (алгоритм разбора
  `artifact_artikul_*.amf`, читается как evidence формата, не подключается
  как зависимость — `SOURCE_BOUNDARY.md`); текущий
  `content/playable-slice.json` как evidence целевой типизации
  (`ArtifactDocument`, `src/modules/content/domain/content-playable-entities.ts`).
- **Content set:** весь Pub1 `Pub1/images/locale/ru/amf/artifact_artikul_*.amf`
  корпус (~22 560 файлов, ~55 МБ входа; ожидаемый выход — единицы МБ
  структурированного JSON, не ассеты). Один сгенерированный content-seed
  файл в формате `ArtifactDocument[]` — тот же тип, что уже использует
  `content/playable-slice.json`, не новый формат. Wire `artikul_id`
  сохраняется без перенумерации. `artikul_weights.json` и другие item-field
  overlays входят как отдельный `provenance: authored` слой того же
  decoder поверх `provenance: live-dump` базовых записей (два
  последовательных `draft_version` одного ключа — `SOURCE_BOUNDARY.md` §
  «Собственные правки поверх базовых данных», не файловый overlay-merge).
- **Architecture checkpoint / decision:** ADR-0011/ADR-0018 достаточны;
  новый ADR/`ARC-*` не нужен — это generated tooling поверх уже принятой
  publication-модели, не новая persistence-модель и не новый public port.
  **Ownership.** `catalog` владеет `artifacts` (без изменений). Decoder —
  новый offline dev-tooling script, не HTTP-хендлер и не production
  request path; не импортируется в domain/application. Раздача статики
  клиенту (`StaticAssetRegistrar`, читает весь `PUB1_DIR` как есть) не
  трогается этой capability и не зависит от decoder.
  **Формат вывода — решение, не оставлено coding agent на догадку.**
  Сейчас `loadContentBundleFile` читает один JSON-объект
  (`PlayableSliceDocuments`) и мержит только `commonConfFile`. Decoder
  выдаёт отдельный committed файл (например
  `content/pub1-items.generated.json`) с тем же типом `artifacts`, а
  bundle-loading расширяется по тому же паттерну, что уже есть у
  `commonConfFile`: явный доп. ключ (например `itemsFile`) на второй
  JSON-файл, чьё содержимое подмешивается в разбираемый bundle **до**
  `parseContentBundle`. Конфликт stable key (`artikul_id`) между
  `playable-slice.json` и generated-файлом — ошибка candidate, не
  last-write-wins и не silent override. `content/playable-slice.json`
  вручную не растится корпусом — генерируемый файл живёт отдельно и
  отдельно коммитится.
  **`db:reset`/`db:publish:development`.** После этой capability
  `npm run db:reset` обязан поднимать полный item-корпус **без**
  смонтированного `PUB1_DIR` — читает только committed generated-файл(ы).
  Decoder — отдельная explicit команда (например
  `npm run content:decode:items`, вызывается вручную при обновлении Pub1
  corpus), не часть `db:reset` и не dynamic import во время runtime.
  **Fail-fast.** Нечитаемый/неизвестный AMF record — весь decode
  завершается ошибкой, не «импортировано 99 из 100»
  (`SOURCE_BOUNDARY.md` § «Правила одного importer»). Дублирующий
  `artikul_id` внутри corpus — ошибка decode. Ссылка на несуществующий
  skill id — ошибка `ContentValidator` на этапе candidate, не молчаливый
  skip на decode.
  **Manifest.** Source manifest перед записью — относительный путь, size,
  digest каждого `.amf`, decoder/schema version, отсортированный список
  authored keys с digest документа (`CONTENT_MATRIX.md` § «Правила
  manifest, count и checksum»). Повторный decode того же Pub1 corpus (тот
  же digest) не создаёт новый файл/версию.
  **Не в этом срезе.** Generic export/import произвольной active release
  (план `CONTENT_PIPELINE.md` § «Экспорт и восстановление» остаётся
  отдельной, не начатой задачей — не путать с этим decoder-специфичным
  файлом); item overlays помимо `artikul_weights.json`; `DATA-05…06`
  (stores/reputation, NPC/квесты — следующие записи этой
  волны по той же схеме, после `DATA-03`).
- **Acceptance:** decode свежего `PUB1_DIR` производит один committed
  JSON-файл с полным corpus (~22 560+ artifacts); wire ID уже
  зафиксированных в existing raw-AMF e2e (9095, 20/21/26, 93, 99, 77, 23,
  24, 621, 553/1310/4603/11408/13224, recruit 27/28/30/33/35/106, mix
  43/46, USE 640/623/2371/55/584, farm 1720/1721/1722, craft 1861/1714,
  монета 5986, …) совпадают между старым `playable-slice.json` и новым
  сгенерированным файлом; `npm run db:reset` на машине **без** `PUB1_DIR`
  успешно поднимает БД только из committed файлов; существующие raw-AMF
  e2e проходят без изменения ожидаемых wire значений; повторный decode
  того же Pub1 corpus даёт тот же digest/файл.
- **Boundary/contract audit (закрыт):** decode/файл/manifest в порядке.
  Cross-field `durability <= durabilityMax` снят миграцией
  `drizzle/0029_catalog_drop_durability_range.sql` на пяти таблицах
  (`catalog.artifacts`, `inventory.items`, `trade.held_items`,
  `mail.letter_attachments`, `auction.listings`); остаются отдельные
  `durability >= 0` / `durabilityMax >= 0`. 37/22 560 dump-строк с
  `current > max` публикуются verbatim (`INVENTORY.md` § INV-05 «Коррекция»).
  Других numeric CHECK-нарушений в корпусе нет. `npm run db:reset` без
  `PUB1_DIR`, `test:integration`, `test:e2e` и `check` зелёные.
  Editor `candidate_entries` пишется батчами по 250 (postgres.js лимит
  65534 параметров на 22 560 ключах). Pocket `persSpells`/`effUse` flags
  `"262144"`, когда AMF опускает `extra.spell.flags` —
  `POCKET_SPELL_WIRE_FLAGS`. Meat 77 USE key — AMF `"5"`, не handwritten
  `"20"`.
- **Status:** `done`

### DATA-03 — Bestiary/bot spellbook/loot corpus decoder

- **ID:** `DATA-03`
- **depends_on:** `DATA-02`, `CMB-06`, `CMB-07`
- **Precondition (уже выполнено, не проверять заново):**
  `CONTENT_MATRIX.md` § «Приоритет» требует, чтобы механика домена стала
  generic до массового импорта. `CMB-06` — «Выбор AI — чистая функция
  `pickBotSpell` … Catalog `BotDefinition.spellBook`» (произвольная книга,
  не только Hissa/Spirit/Red gryzl). `CMB-07` — «Произвольное число
  entries/весов уже в алгоритме». Оба `done`: combat/catalog уже
  domain-generic, массовый импорт этого домена не блокирован дальнейшей
  переработкой движка.
- **Behavior evidence:** [CONTENT_MATRIX.md](CONTENT_MATRIX.md) § три
  строки `DATA-03` (bestiary/bot overlays; spell definitions; base loot);
  `jgr-emu/src/db/seed_bots.ts` (алгоритм разбора `bestiary.amf` +
  authored-overlay порядок `fixtures/bots_overlay.json` /
  `radvei_hunt_bots.json`, читается как evidence формата, не подключается
  как зависимость); `jgr-emu/src/db/seed_bot_spell_book.ts`
  (`fixtures/bot_spell_book.json` — уже curated JSON, не сырой AMF);
  текущий `content/playable-slice.json` bots/`bot_spell_books` как
  evidence целевой типизации.
- **Content set:** полный Pub1 `bestiary.amf` corpus (базовые
  bot stats/look, без spell/loot policy) + authored overlay слой
  `bots_overlay.json`/`radvei_hunt_bots.json` тем же
  двух-`draft_version` паттерном, что `artikul_weights.json` в `DATA-02`
  (`provenance: live-dump` затем `provenance: authored` того же ключа —
  не файловый merge). Отдельно: полный `bot_spell_book.json` (spell
  definitions/AI книги) и base bot loot (`bot_loot_entries` из bestiary
  drops + overlay loot, dwar-lite heuristics как в legacy
  `seed_bots.ts`). Три source group декодируются и валидируются в этом
  порядке, чтобы не создать bot↔spell cycle
  (`CONTENT_MATRIX.md` уже фиксирует эту причину): base bots → spell
  definitions (нужны `DATA-02` items для spell-linked artifacts) → base
  loot (нужны `DATA-02` items и base bots). Wire bot/artikul ID
  сохраняются без перенумерации.
- **Architecture checkpoint / decision:** ADR-0011/ADR-0017–0020
  достаточны; новый ADR/`ARC-*` не нужен — тот же generated-tooling
  паттерн, что `DATA-02`, не новая persistence-модель и не новый public
  port. **Ownership.** `catalog` владеет `bots`/`bot_spell_books`/
  `bot_loot_entries` (без изменений). Decoder(ы) — offline dev-tooling
  script(ы) (например `npm run content:decode:bots`,
  `content:decode:bot-spells`), не HTTP-хендлер, не часть `db:reset`, не
  dynamic import. **Формат вывода.** Один committed файл на source group
  (например `content/bots.generated.json`,
  `content/bot-spell-books.generated.json`,
  `content/bot-loot.generated.json`), тот же тип, что уже использует
  `content/playable-slice.json`. Bundle-loading расширяется тем же
  паттерном, что `itemsFile` у `DATA-02`: явные доп. ключи, содержимое
  подмешивается до `parseContentBundle`. Конфликт stable key (bot id)
  между `playable-slice.json` и generated-файлом — ошибка candidate, не
  last-write-wins. `content/playable-slice.json` вручную не растится
  полным bestiary corpus. **`db:reset`/`db:publish:development`.** После
  этой capability поднимает полный bot+spellbook+loot корпус **без**
  смонтированного `PUB1_DIR` — только committed generated-файл(ы).
  **Fail-fast.** Нечитаемый/неизвестный `bestiary.amf` record — весь
  decode завершается ошибкой. Дублирующий bot id внутри corpus — ошибка
  decode. Ссылка spell/loot на несуществующий item/skill/bot — ошибка
  `ContentValidator` на этапе candidate, не молчаливый skip.
  **Manifest** — те же правила, что `DATA-02`
  (`CONTENT_MATRIX.md` § «Правила manifest, count и checksum»). Повторный
  decode того же corpus не создаёт новый файл/версию. **Не в этом
  срезе.** Размещение новых ботов на area/hunt spawn (`DATA-04`);
  quest-conditioned loot policy (`DATA-05`/`DATA-06`); NPC/dialog
  bindings (`DATA-06`).
- **Acceptance:** decode свежего `PUB1_DIR` производит committed
  bots/spellbook/loot файлы с полным corpus; wire ID уже
  зафиксированных в existing raw-AMF e2e (Hissa **4**/50101, Spirit
  **32**/50102, Red gryzl **24**/50103, Gryzl **2**, dungeon bots
  99/106–109/354/353/373) совпадают между старым `playable-slice.json` и
  новыми generated-файлами; `npm run db:reset` без `PUB1_DIR` поднимает
  полный корпус только из committed файлов; существующие CMB-06/CMB-07
  raw-AMF e2e проходят без изменения wire значений; повторный decode того
  же corpus даёт тот же digest/файлы; `npm run check`, `test:integration`,
  `test:e2e` зелёные до смены статуса на `done` (обязательный
  boundary/contract audit тем же порядком, что закрыл `DATA-02`: сначала
  реальный прогон, потом статус).
- **Boundary/contract audit (закрыт):** decode/файл/manifest в порядке.
  164 bots из `bestiary.amf` (135) + gap-fill dungeon-only IDs + overlay
  upsert. Title = AMF `nick` (Грызл **2**, не handwritten «Грызль»).
  VIT ≡ maxHp (бот 2: 10/STR 8). Overlay loot verbatim: NOTHING 3000 /
  27 entries; `money_min`/`money_max` оба `>= 0` без порядка (бот 117:
  9 и 0, `rollMoneyGold` закрытый интервал между границами). Spell
  gates `once` / `foe_has_dispel_groups`; kind 3/10 picker skips.
  Catalog inserts батчами по 250. `npm run db:reset` без `PUB1_DIR`,
  `test:integration`, `test:e2e` и `check` зелёные.
- **Status:** `done`

### DATA-04 — Areas, links and hunt spawn corpus decoder

- **ID:** `DATA-04`
- **depends_on:** `DATA-03`
- **Precondition (уже выполнено, не проверять заново):**
  `CONTENT_MATRIX.md` § «Приоритет» требует, чтобы механика домена стала
  generic до массового импорта. Travel/hunt/dungeon/BG уже `done` на
  representative dump-proven subset. `DATA-03` закрыл bot refs для spawn.
- **Behavior evidence:** [CONTENT_MATRIX.md](CONTENT_MATRIX.md) § две
  строки `DATA-04` (areas/links; hunt definitions);
  `jgr-emu/src/db/seed_game_config.ts` (`radvei_areas.json` /
  `radvei_client_data.json` / `hunt_spawns.json` / `radvei_hunt_bots.json`,
  читается как evidence формата, не подключается как зависимость);
  текущий `content/playable-slice.json` areas/`areaLinks`/`huntSpawns`
  как evidence целевой типизации.
- **Content set:** полный authored atlas areas/links/client presentation
  плюс hunt spawns/routes/zones. Wire area/hunt/bot ID без перенумерации.
  Provenance: live-dump затем authored overlays того же ключа, не
  файловый merge. Не в этом срезе: DATA-05 stores, DATA-06 NPC/квесты.
- **Architecture checkpoint / decision:** ADR-0011/ADR-0017–0020
  достаточны; новый ADR/`ARC-*` не нужен — тот же generated-tooling
  паттерн, что `DATA-02`/`DATA-03`. **Ownership.** `world` владеет
  `areas`/`area_links`/`hunt_spawns`. Decoder — offline
  `npm run content:decode:areas`, не
  HTTP, не часть `db:reset`, не `import()`. **Формат вывода.** Committed
  generated JSON плюс manifests; bundle keys как `itemsFile`/`botsFile`.
  Конфликт stable key — ошибка candidate. `db:reset` без `PUB1_DIR`.
  **Fail-fast.** Нечитаемый/неизвестный record — весь decode ошибка.
  Ссылка hunt на отсутствующий bot/area — ошибка `ContentValidator`.
- **Acceptance:** decode производит committed areas/hunt файлы; wire ID
  already-e2e (503/501/504/…, hunt 50310/50309/50101–50103, dungeon
  542/544/…) совпадают; `db:reset` без `PUB1_DIR`; existing travel/hunt
  raw-AMF e2e без изменения wire значений; `check` /
  `test:integration` / `test:e2e` зелёные до `done`.
- **Boundary/contract audit (закрыт):** decode/файл/manifest в порядке.
  74 areas (radvei 71 + BG 635/636/637), 156 COME_IN links, 10 authored
  hunt spawns на 501/503. Missing parents `498`/`494`/`505`/`508` →
  `parentId` `""`. Dangling COME_IN omit; NPC/action items не area links.
  Wire `client_data` всегда `""`. Event artikul на spawn — ошибка decode.
  Overlay upsert: 503 sounds/context/`hideRunningFights`; 541 fight bg
  `8_1`; 499/500 `ftimeMax` 0; BG 635–637 fight bg `5_1`. E2e 501 sidebar
  включает «В Поля»; 503 hunt list length 6 (50302/50309–13).
  `npm run content:decode:areas` без `PUB1_DIR`; `db:reset` без `PUB1_DIR`;
  `test:integration`, `test:e2e` и `check` зелёные.
- **Status:** `done`

### DATA-05 — Stores, bonuses and reputation corpus decoder

- **ID:** `DATA-05`
- **depends_on:** `DATA-02`, `DATA-04`
- **Precondition (уже выполнено, не проверять заново):** store buy/RANK,
  INV-04 USE/drink и REP-01 track 5 уже `done` на representative subset.
  `DATA-02` закрыл item refs; `DATA-04` закрыл area refs для магазинов.
- **Behavior evidence:** [CONTENT_MATRIX.md](CONTENT_MATRIX.md) § три
  строки `DATA-05` (required stores; reputation core; bonuses/consumable
  USE); `jgr-emu/src/db/seed_store.ts`, `seed_reputation.ts`,
  `seed_bonuses.ts`, `seed_artifact_use.ts` (non-quest entries) как
  evidence формата, не runtime-зависимость; текущий
  `content/playable-slice.json` store/reputation/bonus/use как evidence
  целевой типизации.
- **Content set:** authored store dumps (`content/stores/*.json`, 23
  файла), 22 type-2 reputation tracks (omit SUM 36; `reputation_kills`
  не импортируется), `bonuses.json` и consume/grant `artifact-use.json`
  (omit 2006/2007/900584). Wire store/lot/track/bonus/script ID
  без перенумерации. Provenance: live-dump затем authored overlays того
  же ключа. Не в этом срезе: DATA-06 quest-aware scripts, NPC/квесты;
  leftover diamond conversion 1:900; unlock-flag grant.
- **Architecture checkpoint / decision:** ADR-0011/ADR-0017–0020
  достаточны; новый ADR/`ARC-*` не нужен — тот же generated-tooling
  паттерн, что `DATA-02`…`DATA-04`. **Ownership.** `catalog` владеет
  store types/lots, reputation tracks, bonuses и
  use scripts. Decoder — offline `npm run content:decode:economy` (имя
  фиксируется при реализации), не HTTP, не часть `db:reset`, не
  `import()`. **Формат вывода.** Committed generated JSON плюс manifests;
  bundle keys как `itemsFile`/`areasFile`. Конфликт stable key — ошибка
  candidate. `db:reset` без `PUB1_DIR`. **Fail-fast.** Нечитаемый/
  неизвестный record — весь decode ошибка. Ссылка lot на отсутствующий
  item/area — ошибка `ContentValidator`.
- **Acceptance:** decode производит committed store/reputation/bonus
  файлы; wire ID already-e2e (store 504 lots 23/24, store 552 lot
  438/621 RANK, reputation track 5, bonus 601, USE 640/623/2371/55/584)
  совпадают; `db:reset` без `PUB1_DIR`; existing store/USE/reputation
  raw-AMF e2e без изменения wire значений; `check` /
  `test:integration` / `test:e2e` зелёные до `done`.
- **Boundary/contract audit (закрыт):** decode/файл/manifest в порядке.
  23 store dumps → 113 types / 2095 lots; 22 type-2 reputation tracks
  (omit SUM 36); 5 skill bonuses 601–605; 7 consume/grant use scripts
  (omit 2006/2007/900584). Dump `lot_id` 0 → `lotId=artikulId`. First
  badge is till; leftover diamond fails; gold shelf for gold-only lots
  is badge cnt. Bundle pay covers multi-barter and mixed gold+barter.
  Fractional gold coins (2 decimals). `requires.any` is OR. Lot
  REPUTATION 36 is derived SUM, not a published track. Store `entries`
  omitted (not a StoreType/Lot field). `reputation_kills` not imported.
  `npm run content:decode:economy` без `PUB1_DIR`; `db:reset` без
  `PUB1_DIR`; `test:integration`, `test:e2e` и `check` зелёные.
- **Status:** `done`

### POST-02 — Profession, farm and recipe corpus decoder

- **ID:** `POST-02`
- **depends_on:** `DATA-02`, `DATA-04`, `PRF-03`
- **Precondition (уже выполнено, не проверять заново):** PRF-01…03
  representative pair 2+6, assistant 3/13, farm 4 on 500, recipe 61 уже
  `done`. `DATA-02` закрыл item refs; `DATA-04` закрыл area refs для
  `area_farms.json`.
- **Behavior evidence:** [CONTENT_MATRIX.md](CONTENT_MATRIX.md) § POST-02;
  `jgr-emu/src/db/seed_professions.ts` как evidence формата, не
  runtime-зависимость; текущие profession/farm/craft documents как
  evidence целевой типизации.
- **Content set:** Pub1 `assistant_list.amf` / `farm_list.amf` /
  `farm_types.amf` / `recipes.amf` плюс authored `content/area-farms.json`.
  Wire ID already-e2e (assistant 3/13, farm 4, recipe 61, area 500 spot 15)
  без перенумерации. Omit leftover: profession-0 voodoo assistants
  (Дух врага, empty picture / level 0); recipe types 2/3/4/5/7
  (`craft|cook_list`/tablets); type-1 profession-0 crafts; XP sentinel
  `16777215`. `farm_types.amf` валидирует `typeId`, отдельной таблицы нет.
  `profession_info` overlay остаётся пара 2+6 (type 3 и license NPC —
  leftover). Не в этом срезе: climate rotation, `GRANT_PROFESSION`,
  fish stats, `common|farm_agregate`, `craft|cook_list`.
- **Architecture checkpoint / decision:** ADR-0011/ADR-0017–0020
  достаточны; новый ADR/`ARC-*` не нужен — тот же generated-tooling
  паттерн, что `DATA-02`…`DATA-05`. **Ownership.** `catalog` владеет
  `assistant_types`, `farm_resources`, `area_farms`, `craft_recipes`.
  Decoder — offline `npm run content:decode:professions`, не HTTP, не
  часть `db:reset`, не `import()`. **Формат вывода.** Committed generated
  JSON плюс manifests; bundle keys как `itemsFile`. Конфликт stable key —
  ошибка candidate. `db:reset` без `PUB1_DIR`. **Fail-fast.** Нечитаемый/
  неизвестный record — весь decode ошибка. Спот на отсутствующую area/farm
  — ошибка decode/`ContentValidator`.
- **Acceptance:** decode производит committed assistant/farm/recipe файлы;
  wire ID already-e2e совпадают; `db:reset` без `PUB1_DIR`; existing
  profession/assistant/craft raw-AMF e2e без изменения wire значений;
  `check` / `test:integration` / `test:e2e` зелёные до `done`.
- **Boundary/contract audit (закрыт):** 45 gathering assistants (omit 8
  voodoo); 83 farm resources включая profession 0 map nodes 73/74/75;
  86 area farms на 17 atlas areas; 266 type-1 craft recipes (omit leftover
  types и profession-0). Dump `farm_time` 60, overlay overrides; stamina
  drain 4. XP bands 8/18/28/38/48/60 совпадают с domain constants.
  `npm run content:decode:professions` с `PUB1_DIR`; `db:reset` без
  `PUB1_DIR`; `test:integration`, `test:e2e` и `check` зелёные.
- **Status:** `done`

### POST-03 — Dungeon corpus decoder

- **ID:** `POST-03`
- **depends_on:** `DNG-03`, `DATA-02`, `DATA-03`, `DATA-04`
- **Precondition (уже выполнено, не проверять заново):** DNG-01…03
  generic instance engine (copy/bind/clear bar/coins/personal) `done`.
  `DATA-04` уже содержит этажи 548–551 / 586–590 / 617–620 и двери
  `flags:256`. `DATA-02`/`DATA-03` закрыли coin/bot refs.
- **Behavior evidence:** [CONTENT_MATRIX.md](CONTENT_MATRIX.md) § POST-03;
  `jgr-emu/src/dungeon/catalog.ts` + `fixtures/dungeons/*.json` как
  evidence формата, не runtime-зависимость; Pub1 `instance.amf` — book
  chrome (id/title), не spawn geometry; текущий `DungeonDocument` как
  evidence целевой типизации.
- **Content set:** восемь authored JSON `content/dungeons/*.json` плюс
  сверка id/title с Pub1 `instance.amf`. Wire ID already-e2e (1/542,
  2/544, 11/654, 12/653, 14/673) без перенумерации. Добавляются
  `has_clear: true` **4/6/7**. Omit leftover: `loot.bands` / `chance` /
  `mob_loot`; AMF records без fixture (3/5/8…); `macroses`; AMF
  `img_url`/`level_min` book chrome (enter gate = fixture `level_min`;
  конфликт Норы fixture **8** vs AMF **9** — канон среза fixture, как
  jgr `catalog.ts`). Не в этом срезе: dungeon shops / плиты NPC,
  abort fight, daily 06:00 wipe.
- **Architecture checkpoint / decision:** ADR-0016/0018/0020 достаточны;
  новый ADR/`ARC-*` не нужен — тот же generated-tooling паттерн, что
  `DATA-02`…`POST-02`. **Ownership.** `catalog` владеет dungeon
  definition. `world` уже владеет floor areas/links (DATA-04). Decoder —
  offline `npm run content:decode:dungeons`, не HTTP, не часть
  `db:reset`, не `import()`. **Формат вывода.** Committed
  `content/dungeons.generated.json` плюс manifest; bundle key
  `dungeonsFile`. Конфликт stable key — ошибка candidate. `db:reset` без
  `PUB1_DIR`. **Fail-fast.** Нечитаемый/неизвестный field — весь decode
  ошибка. Fixture artikul нет в `instance.amf` — ошибка. Title mismatch —
  ошибка. Omitted fixture `hunt_mask` → dump mesh `bot_1`; omitted spawn
  wait → dump 2/8 (как текущий ogre slice).
- **Acceptance:** decode производит 8 dungeon documents; wire ID
  already-e2e совпадают; 4/6/7 публикуются с `instance_conf` progress;
  `db:reset` без `PUB1_DIR`; existing dungeon raw-AMF e2e без изменения
  wire значений; `check` / `test:integration` / `test:e2e` зелёные до
  `done`.
- **Boundary/contract audit (закрыт):** 8 fixtures; AMF 46 chrome rows,
  лишние id omit; bands/mob_loot omit. Провал 4/548 finish 9 coin 3163;
  Норы 6/586 finish 7 coin 5985; Хардиф 7/617 finish 12 coin 3679.
  `npm run content:decode:dungeons` с `PUB1_DIR`; `db:reset` без
  `PUB1_DIR`; `test:integration`, `test:e2e` и `check` зелёные.
- **Status:** `done`

## Content-fill track — сюжет, не брать сейчас

Куратский авторский контент (Акрилон и далее) — не цель переноса (см.
`SOURCE_BOUNDARY.md`). Leftover-движки выше `done`. **Не стартовать**:
остаются queued, не `next`. Эти пункты никогда не входят в `depends_on`
capability волн 0–13.

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
