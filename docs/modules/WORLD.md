# World, hunt и realtime

## Статус

Перенесены published area 503, authored hunt rows и минимальный ATTACK_BOT.
Transitions, presence, movement/respawn и locks ещё не перенесены.

## Источники поведения

- `jgr-emu/docs/AREA_SIDEBAR.md`;
- `jgr-emu/docs/SYNC.md`;
- world-часть `jgr-emu/docs/TRAVEL_BAG.md`;
- `jgr-emu/docs/BESTIARY.md`;
- `jgr-emu/src/huntWorld.ts`, `huntSpawns.ts`, `huntWander.ts`,
  `areaActions.ts`, `routes/esrv.ts`.

## Контракт мира

В текущем runtime area definitions и hunt spawns — authored content active
release. Текущая area героя хранится как `character.heroes.area_id`.
Area links, отдельная world-owned character location и durable world
progression ещё не реализованы.

`common|area_conf` отвечает за location configuration/sidebar.
`common|hunt` содержит только подтверждённые client fields. Map hunt ID
вычисляется как `area × 100 + index`; dungeon IDs в будущем обязаны быть
уникальны в том же response.

## Transitions — план

Будущий COME_IN/exit slice должен включать:

- проверку существующей authored link;
- travel time и ограничения inventory/fight;
- overload gate по INV-02 `bagLoad` (`amount > amountMax`; 20/20 ходит);
- атомарное изменение hero area;
- согласованные state/area/hunt blocks;
- reconnect в новой location.

Отсутствующая area/link/spawn/bot reference является ошибкой. Gryzl или другой
historical bot не подставляется.

## Hunt lifecycle

Текущий authored spawn задаёт bot, position и hunt mask для area 503.
Route/respawn policy, runtime ownership, busy state и timers — план; после
реализации ephemeral state не должен записываться обратно в content.

ATTACK с карты использует конкретный hunt spawn. Quest/menu attack использует
quest bot reference и не подменяется map spawn. В текущем срезе реализован
только минимальный `ATTACK_BOT`; quest/menu flow отсутствует.

Будущий hunt lock:

- не допускает два успешных attack одного spawn;
- снимается после завершения/отмены/timeout;
- stale state очищается после process restart;
- изменение `fight_id` доставляется через area realtime.

## Presence и channels

Presence, area `131:` channels и party `4:` в runtime отсутствуют. При их
переносе presence должен различать area/instance identity и доставлять
enter/leave/update без playerbot shortcuts.

## Architecture checkpoint — план

Перед общим refactor location/presence/hunt locks нужно определить владельца
hero location, ephemeral lease semantics, restart cleanup и границу будущих
instances. Этот документ не задаёт target tables. Выбранный vertical slice
проходит checkpoints `WLD-01`, `RTM-01`, `WLD-02` в
[ROADMAP.md](../migration/ROADMAP.md) по
[PLAYBOOK.md](../migration/PLAYBOOK.md).

## Acceptance будущей полной world wave

- два героя согласованно видят roster и hunt busy;
- concurrent attack имеет одного победителя;
- restart очищает ephemeral locks и сохраняет hero area;
- transition и hunt responses совпадают с legacy wire;
- runtime читает world только из active release.
