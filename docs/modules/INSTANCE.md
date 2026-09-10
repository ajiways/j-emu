# Instance (DNG-01 plan)

## Статус

Ownership и lifecycle зафиксированы. Runtime ещё нет: product-status
[CAPABILITIES.md](../CAPABILITIES.md). Этот документ — план DNG-01, не
готовая возможность.

BG match, dungeon clear bar / coins, quest `personal_only`, remaining
dungeons — не в срезе DNG-01.

## Источники поведения

- `jgr-emu/docs/DUNGEON.md`, `FIGHT_JOIN.md`;
- `jgr-emu/src/dungeon/` (`catalog.ts`, `clear.ts`, copy/bind/expiry);
- `_research/giga_dump_2026-08-11/DUNGEON_INSTANCE.md`;
- representative fixture: `jgr-emu/fixtures/dungeons/ogre_cave.json`
  (artikul `1`, start `542`, parent `501`, `duration_sec=3600`,
  `has_clear: false`).

## Architecture decision

Отдельный ADR не нужен. ADR-0016 / ADR-0018 / ADR-0020 покрывают copy id с
**1**, `instance_id=0` для мира и active combat только в RAM. `ARC-INS`
закрыт ownership, не отдельным coding slice.

Модуль `instance` (`src/modules/instance`), не `world` и не `party`:

| Owner       | Держит                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `instance`  | copy row, bind, unix expiry, killed-spawn projection, dungeon enter policy                     |
| `world`     | authored outdoor areas / links / hunt; не копии                                                |
| `party`     | membership; auto-create on enter через уже существующий party API                              |
| `catalog`   | immutable dungeon definition из active release (не runtime JSON)                               |
| `combat`    | RAM fight; `fight\|conf.instance_id` = copy id, `can_leave:0` в данже. Не импортирует instance |
| composition | `COME_IN` start area → instance enter; floor→floor keep copy; exit parent → presence `0`       |

Dungeon и BG делят **copy identity** (id, type, expires_at). Не делят
membership, score, queue. BG policy — `BG-01`, не таблицы DNG-01.

Мутации copy/bind — одна Drizzle UoW, `FOR UPDATE` строки copy. Inventory
transfer (boss trophy) только через `grantToBag` в composition, как party bag.

Killed spawns — persistent instance state, не combat. Finish hunt пишет spawn
key в copy через composition port после settlement.

Expiry: `duration_sec` с create; kick в `parent_area_id`. Боец в активном бою
не телепортируется, пока бой в RAM; после finish — kick. Sweep как mail TTL
(`DelayScheduler`), не в hot request path кроме явного enter/travel, который
обязан видеть истекшую копию fail-fast.

Dump daily 06:00 MSK / wipe — **не** DNG-01; emu expiry = `duration_sec`.

## Wire (DNG-01)

`COME_IN` в start area: auto-party если нет группы; create или join своей
копии; bind; `common|instance_conf` `{ artikul_id, status:100 }` без
`progress_*` (ogre `has_clear: false`); `state.instance=1`; hunt list копии.

Exit в parent: presence copy `0`, bind остаётся. Reconnect/restart читает
Postgres. `fight|conf.instance_id` = copy id (не 0).

Death/RESURRECT в копии → start_area той же копии (CMB-04 outdoor temple 503
не применяется внутри данжа).

## Вне среза

Clear bar / coins, `loot.bands` / `personal_guaranteed`, bind warning на
invite, `book|instances`, dungeon shops, hunt join team 2, abort fight on
expiry, remaining fixtures (DNG-02).
