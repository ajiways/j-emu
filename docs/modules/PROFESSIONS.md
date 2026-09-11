# Professions (PRF-01 / PRF-02 / PRF-03)

Runtime PRF-01: authored profession pair and hero licenses. Catalog owns
definitions. Character owns `hero_professions` and `learnProfession`.

Runtime PRF-02: gathering assistants, farm jobs, DelayScheduler finish.

Runtime PRF-03: dump recipe **61**, USE `LEARN_RECIPE`, `craft|*` cooldown
and favorites. Higher craft bands remain leftover.

Product status: [CAPABILITIES.md](../CAPABILITIES.md).

## Sources

- `jgr-emu/docs/PROTOCOL.md` (Professions), `FIXTURES.md`, `QUESTS.md`;
- `jgr-emu/src/professions/catalog.ts`, `formulas.ts`, `assistant.ts`,
  `farm.ts`, `sweep.ts`, `craft.ts`;
- dump `common-conf.json` `profession_info` ids **2** / **6**; farm **4** /
  assistant **3** from Pub1 AMF + `area_farms.json` area **500**; recipe
  **61** from Pub1 `recipes.amf` + books **1861** / output **1714**.

## Ownership

No extra ADR. Quest `GRANT_PROFESSION` is QST.

| Owner         | Holds                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `catalog`     | `catalog.professions`; PRF-02 `assistant_types`, `farm_resources`, `area_farms`; PRF-03 `craft_recipes` |
| `character`   | `character.hero_professions`; money debit; PRF-03 craft XP bump via port                                |
| `professions` | PRF-02 jobs/sweep; PRF-03 `hero_recipes`                                                                |
| `inventory`   | loot grant / consume-by-artikul; USE returns `learn_recipe`, does not call professions                  |
| composition   | OA `user\|professions`; `assistant                                                                      | *`; `craft | *`; USE `LEARN_RECIPE` seam; farm sweep |

A grant writes value **1** and does not insert a starter gremlin. Already
licensed id is idempotent (`learned: false`). Unknown / unpublished id is
fail-fast. Gathering mastery stays on the assistant (PRF-02); the hero row
is the license.

`max_profession_skill` is computed from hero level only when at least one
license exists: 0 below 7, else `min(900, 59 + 60 * floor((level-7)/2))`.
Empty licenses always send cap 0.

Publication replaces `common|conf.profession_info` with the typed pair so
ProfessionList only draws ids 2 and 6.

## Content set

`playable-slice/v25`: dump pair Старатель **2** (type 2, gather) and
Знаковед **6** (type 1, craft). Remaining 1/3/4/5/7–16, fishing/cooking
tabs, license NPC — DATA POST-02 / leftover. PRF-03 adds recipe **61**
and artifacts **1861** / **1714**.

## Schema

- `catalog.professions(release_id, id, title, type, skill_id, picture,
position, skill_step_override, skill_minlvl_override, description,
info_url, user_stat_id)` PK `(release_id, id)`; type 1 or 2; id 1…16;
- `character.hero_professions(hero_id, profession_id, value)` PK, FK
  heroes restrict; `value >= 1`; `profession_id` 1…16.

PRF-02 tables: `catalog.assistant_types`, `farm_resources`,
`area_farms`; `professions.hero_assistants` (identity id), `hero_farm_stats`,
`farm_stocks`. Runtime writes explicit FREE sentinels; no request-path
SQL DEFAULT as business value.

PRF-03: `catalog.craft_recipes` authored id (slice **61**); ingredients JSON
is typed `{artikul_id, amount}` only — unknown type fails publication.
`professions.hero_recipes(id identity START 1, hero_id, recipe_id, ftime,
flags)` UNIQUE `(hero_id, recipe_id)`. Wire `artikul_id` = recipe id, not
the book. XP bands are dump-proven domain constants, not a catalog table.

SQL DEFAULT only for migrate; runtime writes explicit value 1. No row = not
licensed. Progress is not `hero_skills` / `PR_*`.

## Public ports

`learnProfession({ characterId, professionId })`:

- `professionId` must be published;
- ghost hero — typed error;
- missing row → insert `value:1`, `learned: true`;
- existing `value >= 1` → no write, `learned: false`.

Read: licenses for the hero. Wire filters nothing: unpublished row is an
integrity error.

## Wire

`user|professions` nested `{ status:100, professions, max_profession_skill }`.
`professions` is 16 slots, index = `id - 1`. Empty `{ value:0 }`. Active
`{ id, active:true, value }`. Same block on `common|init`. OA `user|professions`
is a production read, not a stub.

`common|conf.profession_info` keys are the published ids; `enabled` is not on
wire; `skill_*_override` null → `false`.

Reconnect/restart reads PostgreSQL.

## Fail-fast

No silent skip of unpublished ids (legacy skipped disabled 10). Missing
pair 2+6 in the release fails publication. Do not copy `hero_skills` for
`PR_*`.

## PRF-02 — assistants and gathering

Dump cycle: assistant **3** Имуро-Юи (`next` **13**), farm **4** Хрусталь
(artikul **1720**, `farm_time` 60, drain 4) on playable area **500** (also
501). First slot **10** gold. Upgrade 3→13 consumes dump XML (1720×180,
1721×170, 1722×170). Starter gremlin is `assistant|create`, not
`learnProfession`.

**Clock:** `DelayScheduler` + `Clock`, same pattern as mail TTL. Sweeper is
the only writer of `cycle_result` / loot / mastery tick / stock decrement.
OA `assistant|*` does not lazily `resolveExpired`. On process start: process
due rows, then arm next dueAt (and a bounded interval catch-up). Tests
advance `MutableClock` and `ManualCombatDelay.fireDue`.

**RNG:** factory requires `{ unit(): number }`. `farmAttackAt` / `farmCycle`
take that RNG; tactic match (climate 0 → gremlin tactics 1) is always
success. Climate rotation is leftover; slice uses authored `area_farms.tactics`.

**Wire:** `assistant|info` / `farm_info` / work / repeat / revoke / save /
create / upgrade. Fields `id` / `artikul_id` / `farm_id` / `skills` on AMF
root (`envelope.root`), merged with `form`. FREE sentinels `farm_id=0`,
`ftime=0` match dump (not hero IDs). Finish pushes esrv
`assistant|farm_result`. `common|farm_agregate` stays chrome leftover.

**Fail-fast:** missing type/node/license/area spot/artifact 1720; unpublished
id; ghost on mutating OA. No request-time finish if sweeper has not written
`cycle_result` (`Ещё не готово`).

## PRF-03 — craft

Dump cycle: recipe **61** «Раствор хрусталя» (profession **6**,
`skill_value` 0, `max_skill_value` 60, `duration` **35**), book **1861**
(`LEARN_RECIPE`, dispose 1), ingredient **1720**×1, output **1714**×10.
Learn and craft require hero level ≥7 (`max_profession_skill` 59) and
license 6. Remaining bands (66/71/…) are DATA POST-02.

**Clock:** request-time consume+grant. Cooldown is `hero_recipes.ftime`
checked on the next `craft_items` (`Рецепт ещё готовится`). No
DelayScheduler job. Tests advance `MutableClock`.

**RNG:** same factory `{ unit(): number }` as gathering. `rollCraftXp`
uses dump bands (delta 8/18/28/38/48/60 → 90/50/25/15/5/3%). Cap is
`min(recipe.max_skill_value, levelCap)`. Gathering professions 1–3 never
bump the hero row.

**Wire:** `craft|user_recipes_list` nested studied rows
`{ id, user_id, artikul_id, ftime, flags, rand_seed:0 }`; `flags` bit0 =
favorite. `recipe_id` on AMF root. `craft_items` / favorite OA are flat:
payload + `craft|user_recipes_list` + `user|bag`; `user|professions` only
when value changed. `craft|cook_list` stays empty leftover.

**USE:** `useFromBag` returns `kind: "learn_recipe"`; composition calls
`professions.learnFromBook` then `consumeBagCharge`. Piggyback
`craft|user_recipes_list`. Inventory does not import professions.

**Fail-fast:** missing recipe/book/license/ingredient/output; unpublished
id; ghost; already learned; skill/cap gate (`Недостаточное мастерство`);
`recipe_id` absent (no `|| 0`).

## Out of scope

`GRANT_PROFESSION` quest op. Ids 1/3/4/5/7–16. Profession swap NPC.
Climate rotation. Full Pub1 assistant/farm/recipe corpus (DATA POST-02).
Fish stats. `common|farm_agregate` live overlay. Craft mastery chat line.
`craft|cook_list`.

## Acceptance

PRF-01:

- unit: cap 0/59/119; wire 16 slots; grant 2+6; reject unknown; second grant
  no-op;
- raw-AMF: empty init cap 0; after `learnProfession(2)` and `(6)` active
  slots persist restart; at level 7 cap 59; `profession_info` only `"2"`/`"6"`;
- CEF вкладка профессий не обязательна без квеста Элии: workflow `done`,
  product **частично**.

PRF-02:

- create 3 for 10 gold; work farm 4 in area 500; sweeper finish; repeat loot
  1720; revoke; upgrade 3→13; persist restart; no OA lazy resolve.

PRF-03:

- L7 + license 6; USE book 1861 learns 61 and consumes the book; craft 61
  consumes 1720 and grants 1714×10; cooldown 35s blocks retry; favorite
  bit0; XP bump persists restart; second USE of 1861 fails already-learned.
