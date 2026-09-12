# Instance

Runtime DNG-01/DNG-02: authored dungeon definition creates a PostgreSQL copy,
binds the entering hero, isolates hunt/presence per copy, expires by
`duration_sec`, and returns occupants to the parent area. Active combat stays
in RAM. Extra `has_clear: false` dungeons publish through the same typed
document; a spawn authors either `route` or `zone`, not both.

Published content: ogre cave `1`/542/bot 99, kopi `11`/654/bot 354, tomb
`12`/653/bot 353, usadba `14`/673/bot 373. Product status:
[CAPABILITIES.md](../CAPABILITIES.md).

BG match is [BATTLEGROUND.md](BATTLEGROUND.md) (`copy_type='bg'`, no dungeon
bind). Instance book tab is [BOOK.md](BOOK.md). Dungeon clear bar / coins,
quest `personal_only`, `has_clear: true` fixtures — not in this slice.

## Sources

- `jgr-emu/docs/DUNGEON.md`, `FIGHT_JOIN.md`;
- `jgr-emu/src/dungeon/` (catalog, copy/bind/expiry);
- `_research/giga_dump_2026-08-11/DUNGEON_INSTANCE.md`;
- fixtures `jgr-emu/fixtures/dungeons/ogre_cave.json`,
  `bezdonnye_kopi.json`, `usypalnica_geroev.json`,
  `zabroshennaya_usadba.json`.

## Ownership

No extra ADR. ADR-0016 / ADR-0018 / ADR-0020 cover copy id from **1**,
world `instance_id=0`, and RAM-only active combat.

| Owner       | Holds                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `instance`  | copy row, bind, unix expiry, killed-spawn rows, dungeon enter policy                            |
| `world`     | authored outdoor areas / links / hunt; not copies                                               |
| `party`     | membership; auto-create on enter via `ensureParty`                                              |
| `catalog`   | immutable dungeon definition from the active release                                            |
| `combat`    | RAM fight; composition overlays `fight\|conf.instance_id` and `can_leave:0`. No instance import |
| composition | `COME_IN` start → enter; floor→floor keep copy; parent exit → presence `0`; TTL sweep           |

`heroes.instance_copy_id` is a nullable integer without FK (NULL = world) so
character and instance schemas do not cycle. Binds FK to `instance.copies`
and `character.heroes`. Copy id is PostgreSQL identity from 1.

Killed spawns are persistent instance rows, not combat JSONB. Hunt win
writes the spawn key through composition and forgets the RAM wander entry.
Dungeon hunt lives in a second `HuntWanderRuntime` keyed
`dungeon:${copyId}:${areaId}`. Hunt id = dump `dungeonHuntId(copyId, spawn_key)`.

Expiry: `duration_sec` from create; kick to `parent_area_id` bypassing travel
lock. Occupant in a RAM fight → `pending_kick`, kick after finish. Sweep
uses `DelayScheduler` at 15s, same pattern as mail TTL. Enter/travel on an
expired bind fail-fast (status `2`); the runtime does not silently open a
new copy.

## Wire

`COME_IN` into a dungeon start: level gate status `204`; no party → auto
`party|create` chrome on the same flat; create or rejoin the bound copy;
`common|instance_conf` `{ artikul_id, status:100 }` without `progress_*`;
`state.instance=1`; hunt list of that copy. `character-info.instance_id` is
the copy id (world `0`).

Exit to parent: presence copy `0`, bind remains. Reconnect/restart reads
Postgres. `fight|conf.instance_id` is the copy id string; `can_leave:0`.
Серверный `leaveFight` deny в копии — QST-ENG-04 (сейчас overlay без deny).
OA `FIGHT_JOIN` / `FIGHT_HELP` в копии landed (CMB-11): тот же RAM
`instanceCopyId`, что у opener; чужая копия = dump 204 «другой локации».
Карта ATTACK_BOT в копии остаётся team 1.

Death/RESURRECT in a copy → start area of the same live copy (ogre is already
542). Outdoor temple 503 is not applied inside the dungeon.

## Out of slice

Clear bar / coins, `loot.bands` / `personal_guaranteed`, bind warning on
invite, dungeon shops, abort fight on expiry, `has_clear: true` fixtures
(2/4/6/7), POST-03 mass importer, daily 06:00 MSK wipe. Hunt join team 2
в копии landed (CMB-11); leftover этого модуля — вторая дуэль / N×N не
сюда.
