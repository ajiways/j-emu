# Professions (PRF-01)

Runtime PRF-01: authored profession pair and hero licenses. Catalog owns
definitions. Character owns `hero_professions` and `learnProfession`.
Assistants, farm jobs, recipes and craft are leftover.

Product status: [CAPABILITIES.md](../CAPABILITIES.md).

## Sources

- `jgr-emu/docs/PROTOCOL.md` (Professions), `FIXTURES.md`, `QUESTS.md`;
- `jgr-emu/src/professions/catalog.ts`, `formulas.ts`, `assistant.ts`
  (`grantHeroProfessions`, `buildUserProfessions`);
- dump `common-conf.json` `profession_info` ids **2** / **6**.

## Ownership

No extra ADR. Scheduler clock is PRF-02. Quest `GRANT_PROFESSION` is QST.

| Owner       | Holds                                                                 |
| ----------- | --------------------------------------------------------------------- |
| `catalog`   | `catalog.professions` from the active release                         |
| `character` | `character.hero_professions` (`hero_id`, `profession_id`, `value`)    |
| composition | OA `user\|professions`; init overlay; `learnProfession` internal port |

`professions` target module (jobs, assistants, craft) stays deferred.
Inventory and world ports are not used in this slice.

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

## Out of scope

Assistants / farm / `farm_stats` / stamina (PRF-02). Recipes / craft /
favorites (PRF-03). `GRANT_PROFESSION` quest op and starter gremlin.
Ids 1/3/4/5/7–16. Profession swap NPC.

## Acceptance

- unit: cap 0/59/119; wire 16 slots; grant 2+6; reject unknown; second grant
  no-op;
- raw-AMF: empty init cap 0; after `learnProfession(2)` and `(6)` active
  slots persist restart; at level 7 cap 59; `profession_info` only `"2"`/`"6"`;
- CEF вкладка профессий не обязательна без квеста Элии: workflow `done`,
  product **частично**.
