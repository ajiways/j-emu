# Professions (PRF-01 / PRF-02)

Runtime PRF-01: authored profession pair and hero licenses. Catalog owns
definitions. Character owns `hero_professions` and `learnProfession`.

Runtime PRF-02 (checkpoint; coding next): gathering assistants, farm jobs,
DelayScheduler finish. Recipes / craft remain PRF-03 leftover.

Product status: [CAPABILITIES.md](../CAPABILITIES.md).

## Sources

- `jgr-emu/docs/PROTOCOL.md` (Professions), `FIXTURES.md`, `QUESTS.md`;
- `jgr-emu/src/professions/catalog.ts`, `formulas.ts`, `assistant.ts`,
  `farm.ts`, `sweep.ts`;
- dump `common-conf.json` `profession_info` ids **2** / **6**; farm **4** /
  assistant **3** from Pub1 AMF + `area_farms.json` area **500**.

## Ownership

No extra ADR. Quest `GRANT_PROFESSION` is QST.

| Owner         | Holds                                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| `catalog`     | `catalog.professions`; PRF-02 `assistant_types`, `farm_resources`, `area_farms` |
| `character`   | `character.hero_professions`; money debit for create/upgrade                    |
| `professions` | PRF-02 `hero_assistants`, `hero_farm_stats`, `farm_stocks`; sweep               |
| `inventory`   | PRF-02 loot grant / upgrade consume by artikul                                  |
| composition   | OA `user\|professions`; `assistant                                              | *`; DelayScheduler farm sweep |

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

`playable-slice/v24`: dump pair Старатель **2** (type 2, gather) and
Знаковед **6** (type 1, craft). Remaining 1/3/4/5/7–16, fishing/cooking
tabs, license NPC — DATA POST-02 / leftover.

## Schema

- `catalog.professions(release_id, id, title, type, skill_id, picture,
position, skill_step_override, skill_minlvl_override, description,
info_url, user_stat_id)` PK `(release_id, id)`; type 1 or 2; id 1…16;
- `character.hero_professions(hero_id, profession_id, value)` PK, FK
  heroes restrict; `value >= 1`; `profession_id` 1…16.

PRF-02 tables (coding next): `catalog.assistant_types`, `farm_resources`,
`area_farms`; `professions.hero_assistants` (identity id), `hero_farm_stats`,
`farm_stocks`. Runtime writes explicit FREE sentinels; no request-path
SQL DEFAULT as business value.

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

## Out of scope

Recipes / craft / favorites (PRF-03). `GRANT_PROFESSION` quest op.
Ids 1/3/4/5/7–16. Profession swap NPC. Climate rotation. Full Pub1
assistant/farm corpus (DATA POST-02). Fish stats. `common|farm_agregate`
live overlay.

## Acceptance

PRF-01:

- unit: cap 0/59/119; wire 16 slots; grant 2+6; reject unknown; second grant
  no-op;
- raw-AMF: empty init cap 0; after `learnProfession(2)` and `(6)` active
  slots persist restart; at level 7 cap 59; `profession_info` only `"2"`/`"6"`;
- CEF вкладка профессий не обязательна без квеста Элии: workflow `done`,
  product **частично**.

PRF-02 (plan until coding e2e is green):

- create 3 for 10 gold; work farm 4 in area 500; sweeper finish; repeat loot
  1720; revoke; upgrade 3→13; persist restart; no OA lazy resolve.
