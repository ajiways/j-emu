# Instance

Runtime DNG-01/DNG-02: authored dungeon definition creates a PostgreSQL copy,
binds the entering hero, isolates hunt/presence per copy, expires by
`duration_sec`, and returns occupants to the parent area. Active combat stays
in RAM. Extra `has_clear: false` dungeons publish through the same typed
document; a spawn authors either `route` or `zone`, not both.

DNG-03 (этот срез, ещё не landed): generic `has_clear` progress bar, clear
coins on boss kill, and dungeon `personal_guaranteed`. Product status stays
[CAPABILITIES.md](../CAPABILITIES.md) until coding closeout.

Published today: ogre cave `1`/542/bot 99, kopi `11`/654/bot 354, tomb
`12`/653/bot 353, usadba `14`/673/bot 373. DNG-03 adds pit `2`/544.

BG match is [BATTLEGROUND.md](BATTLEGROUND.md) (`copy_type='bg'`, no dungeon
bind). Instance book tab is [BOOK.md](BOOK.md). Quest `personal_only` is
inventory/quests, not this module.

## Sources

- `jgr-emu/docs/DUNGEON.md`, `FIGHT_LOOT.md`, `FIGHT_JOIN.md`;
- `jgr-emu/src/dungeon/` (`clear.ts`, `loot.ts`, `kick.ts`, catalog);
- `_research/giga_dump_2026-08-11/DUNGEON_INSTANCE.md`;
- fixtures `ogre_cave.json`, `poganaya_yama.json`, `bezdonnye_kopi.json`,
  `usypalnica_geroev.json`, `zabroshennaya_usadba.json`.

## Ownership

No extra ADR. ADR-0016 / ADR-0018 / ADR-0020 cover copy id from **1**,
world `instance_id=0`, and RAM-only active combat. `ARC-INS` already closed
copy vs world. Abort-fight vs `pending_kick` is not an ADR: jgr never shipped
abort (see conflict below).

| Owner       | Holds                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `instance`  | copy row, bind, unix expiry, killed-spawn rows, dungeon enter policy, clear progress from keys  |
| `catalog`   | immutable dungeon definition: `hasClear`, `progressFinishValue`, `clear` coins, `loot` personal |
| `world`     | authored outdoor areas / links / hunt; not copies                                               |
| `party`     | membership; auto-create on enter via `ensureParty`                                              |
| `inventory` | bag grants for coins / `personal_guaranteed` (`personal_only`, ignores party `loot_rules`)      |
| `combat`    | RAM fight; composition overlays `fight\|conf.instance_id` and `can_leave:0`. No instance import |
| composition | enter/travel; hunt-win UoW: mark spawn, grant personal/coins, esrv `instance_conf`; TTL sweep   |

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

**Конфликт, не замазывать.** jgr `DUNGEON.md` / CAPABILITIES: duration kick
«If in fight → kick after finish **(TODO: abort fight)**». Runtime
`tickDungeonExpire` only kicks heroes **not** in a live fight; in-fight sets
`pendingKick` and `maybeKickAfterFight` teleports after finish. Dump of
mid-fight abort нет. Этот срез **не** рвёт RAM-бой по TTL. Текущий
`pending_kick` уже совпадает с jgr.

## Clear bar and coins (DNG-03)

Client рисует полосу **только если** `common|instance_conf` содержит
`progress_*`. `has_clear: false` (огр dump) — `{ artikul_id, status:100 }`,
без `progress_*`. `instanceConf` больше не бросает на `hasClear`; отсутствие
progress на `hasClear: true` — fail-fast.

`counts_for_clear` живёт на **spawn**, не на encounter head. Один hunt-win
этого спавна = **+1**, включая босса. Bar = число убитых spawn с
`counts_for_clear !== false`, cap `progress_finish_value`. Яма dump:
`progress_finish_value` **7** (6 trash + boss).

Если `hasClear` и authored `progressFinishValue` нет — взять
`counts_for_clear` count, иначе `boss` count; ноль — ошибка публикации, не
`instanceConf` throw на ogre.

Wire (jgr `pushInstanceConf`): `artikul_id` string; при `hasClear` —
`progress_finish_value` **string**, `progress_value` **number**, `status:100`.
Пушить: вход в start, floor→floor (копия жива), и esrv clear-tick когда
progress сдвинулся. Tick — team-1 humans этого боя (jgr), не все occupants
копии.

Монеты: только kill спавна `is_boss` (или мёртвый `loot.boss_bot_id`). Не
за каждый trash tick. Сумма = `clearCoinTotal` jgr (формула **invented** до
live dump, канон этого среза — тот же код): `round(coin_max × progress /
finish)`, clamp `[coin_min, coin_max]`; `level` не используется. Это
**итог на текущем progress**, не дельта тиков. Каждому team-1 —
`personal_only`. Пустой `clear` / нет `coin_artikul_id` — монет нет (яма
авторит 5986).

## personal_guaranteed (DNG-03)

Не рулетка и не clear bar. Ids на `loot.personal_guaranteed`: каждому
team-1 по 1 шт на **boss** kill, сразу в bag, `personal_only`, игнор party
`loot_rules`. Исключить эти id (и coin artikul) из world `rollBotLoot`,
чтобы не удвоить. Огр dump: **2371**. Яма: `[]`.

`loot.bands` / `mob_loot` overlay — не этот срез: огр bands в fixture не
авторить; world table бота 99 остаётся пустой.

## Catalog / schema (DNG-03)

`catalog.dungeons` (план миграции coding): nullable `progress_finish_value`;
nullable `coin_artikul_id` / `coin_min` / `coin_max` — все три вместе или
все null; `loot_boss_bot_id` nullable. Таблица
`catalog.dungeon_personal_guaranteed` PK
`(release_id, dungeon_artikul_id, loot_artikul_id)`. Не jsonb bands.

Публикация: `hasClear` → хотя бы один `countsForClear`; coin artikul и
personal ids обязаны существовать в artifacts; `hasClear: false` не несёт
`progress_*` и не авторит `progressFinishValue`/`clear`. Яма L11, duration
43200, `img_url` dump.

## Wire (landed + DNG-03)

`COME_IN` into a dungeon start: level gate status `204`; no party → auto
`party|create` chrome on the same flat; create or rejoin the bound copy;
`common|instance_conf` как выше; `state.instance=1`; hunt list of that copy.
`character-info.instance_id` is the copy id (world `0`).

Exit to parent: presence copy `0`, bind remains. Reconnect/restart reads
Postgres. `fight|conf.instance_id` is the copy id string; `can_leave:0`.
Серверный `leaveFight` в копии — dump `{rs:false, err:"нельзя выйти из боя"}`
(QST-ENG-04).
OA `FIGHT_JOIN` / `FIGHT_HELP` в копии landed (CMB-11): тот же RAM
`instanceCopyId`, что у opener; чужая копия = dump 204 «другой локации».
Карта ATTACK_BOT в копии остаётся team 1.

Death/RESURRECT in a copy → start area of the same live copy. Outdoor temple
503 is not applied inside the dungeon.

Composition hunt-win: peek dungeon fight→spawn **до** `releaseFight` (mapping
ещё жив). Combat snapshot spawn key не обязан; combat instance не импортирует.
`HuntFightSettlement` грантит personal/coins в том же UoW, что HP/EXP/world
loot; `InstanceHuntLockRelease` по-прежнему `markSpawnKilled` (idempotent
`ON CONFLICT DO NOTHING`) и forget wander. Progress esrv после mark, если
bar сдвинулся.

World loot / money / EXP — по-прежнему opener-team top damager (CMB-07).
Dungeon personal/coins — **каждый** team-1, не только top damager.

## Out of slice

`loot.bands` / `mob_loot` overlay; abort fight mid-expire; bind warning on
invite; dungeon shops (830/724/741/829); `has_clear: true` fixtures **4/6/7**;
POST-03 mass importer; daily 06:00 MSK wipe; outdoor 508 / hunts / NPC 510;
яма spell `effect_ids` босса 106 (книга пустая, как 353/354/373). Hunt join
team 2 в копии landed (CMB-11); leftover этого модуля — вторая дуэль / N×N
не сюда.
