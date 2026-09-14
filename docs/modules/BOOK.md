# Book

Runtime BOOK-01: `book|bestiary_info` and `book|instances` are read models
over persisted hunt wins and dungeon binds. Catalog (bot panels, instance
titles) stays in client Pub1 AMF. No extra content document.

Product status: [CAPABILITIES.md](../CAPABILITIES.md).

## Sources

- `jgr-emu/docs/BESTIARY.md`, `DUNGEON.md`;
- `jgr-emu/src/bestiary.ts`, `src/dungeon/book.ts`.

## Ownership

No extra ADR. Kill counters are a durable hunt outcome, not a copy of RAM
combat or of 72-hour `finished_fights`. Instance book does not duplicate
copy rows.

| Owner       | Holds                                                                |
| ----------- | -------------------------------------------------------------------- |
| `character` | `character.hero_bot_kills` (`hero_id`, catalog `bot_id`, `win_cnt`)  |
| `instance`  | live/expired bind+copy read for the book tab; no second table        |
| `combat`    | RAM fight only; composition credits kills inside the hunt finish UoW |
| composition | OA `book\|bestiary_info`, `book\|instances`; hunt win → `noteWin`    |

A hunt win credits the top damager, or every fight participant in that
hero's party (including fled). Practice and PvP do not write kills. Defeat
and last-leave do not write kills.

`book|instances.active` is a live dungeon bind (`expires_unix > now`).
Expired binds of catalog dungeons go to `blocked` with `dtime` =
`expires_unix` (daily wipe leftover still owns cleanup). Unknown artikul
on a bind is a fail-fast error.

## Wire

`book|bestiary_info` → `{ status:100, bots: { "<id>": { id, win_cnt } } }`
with string fields; only `win_cnt > 0`. Empty `bots: {}` is valid (AMF3
empty assoc map; JS decoder reads `[]`).

`book|instances` → `{ status:100, active, blocked }` indexed `"0"…`.
Active row `{ artikul_id }`. Blocked row `{ artikul_id, dtime }`. Empty
maps decode the same way.

## Out of slice

Quest book, achievements, dungeon cooldown wipe at 06:00 MSK,
`show_in_book` flags not authored in the playable slice.
