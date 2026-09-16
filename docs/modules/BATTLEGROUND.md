# Battleground

Runtime BG-01: authored Раскоп card (`general|2`) queues two heroes, opens a
120s invite, teleports them into an isolated `copy_type='bg'` copy (rooms
635/636/637), runs 1v1 `ATTACK` PvP to 20 points or 10 minutes, then pushes
ordered finish packets, writes typed history, and kicks to area 500. Queue,
invite, ban and live score live in process RAM. Active combat stays in RAM
(ADR-0020). Copy id is PostgreSQL identity from **1**, not the legacy
`11_000_000` floor.

Product status: [CAPABILITIES.md](../CAPABILITIES.md).

## Sources

- `jgr-emu/docs/BATTLEGROUNDS.md`;
- `jgr-emu/src/bg/` (queue, match, wire, history);
- fixture `jgr-emu/fixtures/bg_raskop_areas.json`;
- dump `_research/giga_dump_2026-08-11/` (`BG_MATCH.md`).

## Ownership

No extra ADR. ADR-0016 / ADR-0018 / ADR-0020 cover copy id from **1**, world
`instance_id=0`, and RAM-only active combat. `ARC-INS` already split dungeon
binds from BG match policy.

| Owner          | Holds                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `battleground` | RAM queue/invite/ban/live score; typed `battleground.finished_*` history; Раскоп card catalog                             |
| `instance`     | `copy_type='bg'` copy row and unix expiry; no dungeon bind                                                                |
| `world`        | outdoor 500 and BG rooms/links; `area_conf.bg_id` from authored `bgId`                                                    |
| `combat`       | RAM PvP battle; no battleground import. Composition overlays `type:"1"` / `flags:"128"`                                   |
| `character`    | `kind` 2/3 for the match, restored to 1 on kick; location / copy shard; persist `heroes.honor` via `grantHonor` (HERO-01) |
| composition    | OA `arena                                                                                                                 | *`, `ATTACK`, teleport/kick, esrv windows/stats/map/finish, restart orphan eject; PvP honor UoW |

## Wire

`arena|list` / `arena|bg` overlay dump catalog rows (Раскоп `available:1`,
`queue_level:"[6 - 7]"`). `arena|bg_request` `add|delete|confirm` returns
status **2** on deny (not 203). Invite is esrv `common|window` TTL 120s.
Both confirm → `arena|bg_waiting` then `{start:1}` → teleport (kind 2 → 637,
kind 3 → 635). `COME_IN` 636. `common|object:ATTACK` `{nick}` starts PvP
`is_pvp:1`, `type:"1"`, `flags:"128"`, `bg:"5_1"`, `can_leave:1`. Score 20
per kill or 600s timeout → esrv `arena|bg_finish` + kick 500. OA
`FIGHT_JOIN` / `FIGHT_HELP` into a live Раскоп PvP fight — CMB-16, same
`fightId`/`instance_id`, same-copy only.

`arena|bg_running` empty page. `arena|bg_finished` typed history, page size 10. `arena|great_fights` `{fight_ids:[]}`. `arena|leader_rating` dump groups
and `rating:{}` (leftover).

Restart drops RAM queue/match. A hero still sitting in 635/636/637 without a
live match is kicked to 500 on `common|init` / `init2`.

## HERO-01 — match honor

Per-fight raw honor считается в composition из combat snapshot и пишется
character `grantHonor`. Этот модуль копит RAM `player.honor` / `dmg` /
`rank` (сумма боёв) и пишет те же поля в `battleground.finished_*` на
`arena|bg_finish`. `honor_bonus` остаётся 0. Live `user_stats.honor` и
финиш — сумма боёв, не отдельный lump матча. Observer читает кэш
settlement на `fightId` (оба героя), не пересчитывает формулу. После
гранта — `pushMapAndStats` плюс esrv `user|unitframe` / `user|conf`.

Печать справедливости (каталог `{level}-{LEVEL_MAX}`, L6→8668, grant на
start / strip на kick) **не** в этом срезе.

## Out of slice

Fairness seal, other BG maps (POST-04), slaughter / fortress / companion,
`arena|leader_rating` fill, 637 ritual `client_data` overlay, PvP EXP
overlay on stats. RESURRECT dest inside a live copy: `spawnAreaForKind`
(kind 2 → 637, kind 3 → 635); `ensureResurrectArea` currently no-ops for
`copy_type='bg'`. Outdoor 503 is not a BG dest. Graph:
[WORLD.md](WORLD.md) leftover.
