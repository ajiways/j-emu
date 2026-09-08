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

Area definitions, links и hunt spawns — authored content active release.
Текущая area героя и durable progression — player state.

`common|area_conf` отвечает за location configuration/sidebar.
`common|hunt` содержит только подтверждённые client fields. Map hunt ID
вычисляется как `area × 100 + index`; dungeon IDs в будущем обязаны быть
уникальны в том же response.

COME_IN/exit переносит:

- проверку существующей authored link;
- travel time и ограничения inventory/fight;
- атомарное изменение hero area;
- согласованные state/area/hunt blocks;
- reconnect в новой location.

Отсутствующая area/link/spawn/bot reference является ошибкой. Gryzl или другой
historical bot не подставляется.

## Hunt lifecycle

Authored spawn задаёт bot, position, route и respawn policy. Runtime ownership,
busy state и timers не записываются обратно в content.

ATTACK с карты использует конкретный hunt spawn. Quest/menu attack использует
quest bot reference и не подменяется map spawn.

Hunt lock:

- не допускает два успешных attack одного spawn;
- снимается после завершения/отмены/timeout;
- stale state очищается после process restart;
- изменение `fight_id` доставляется через area realtime.

## Presence и channels

Переносятся personal `2:`, party `4:` только после появления party и area
`131:` channels. Presence различает area/instance identity и доставляет
enter/leave/update без playerbot shortcuts.

## Acceptance

- два героя согласованно видят roster и hunt busy;
- concurrent attack имеет одного победителя;
- restart очищает ephemeral locks и сохраняет hero area;
- transition и hunt responses совпадают с legacy wire;
- runtime читает world только из active release.
