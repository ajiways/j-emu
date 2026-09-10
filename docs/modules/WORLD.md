# World, hunt и realtime

## Статус

Переходы 503↔504/501 и presence roster **готово**: raw-AMF E2E (два героя,
esrv `2:`/`131:`, chat auth). Точный статус:
[CAPABILITIES.md](../CAPABILITIES.md).

Hunt overlay и map join **готово**: первый ATTACK_BOT 50310 ставит
`fight_id`, второй входит в тот же бой (`joinHunt` team 1). Authored
wander/respawn для 50310 в dump нет — не выдумывать. Melee loop — CMB-01
(raw-AMF). Pocket fight cast — CMB-02 (raw-AMF). Terminal loot/HP — CMB-03
(raw-AMF). Mid-fight F5 `fight|conf` — CMB-04 (raw-AMF; CEF не прогонялся).

## Источники поведения

- `jgr-emu/docs/AREA_SIDEBAR.md`;
- `jgr-emu/docs/SYNC.md`;
- world-часть `jgr-emu/docs/TRAVEL_BAG.md`;
- `jgr-emu/docs/BESTIARY.md`;
- `jgr-emu/src/travel.ts`, `areaActions.ts`, `routes/oa/commonObject.ts`
  (`COME_IN`), `routes/oa/common.ts` (`exit`), `presence.ts`, `esrvOutbox.ts`,
  `routes/esrv.ts`, `huntWorld.ts`, `huntLocks.ts`, `huntWander.ts`;
- authored `jgr-emu/fixtures/radvei_areas.json` (areas 501, 503, 504).

## Контракт мира

Area definitions и hunt spawns — authored content active release. Текущая
area героя хранится как `character.heroes.area_id`. `common|area_conf`
отвечает за location configuration/sidebar. `common|hunt` содержит только
подтверждённые client fields. Map hunt ID вычисляется как
`area × 100 + index`; dungeon IDs в будущем обязаны быть уникальны в том же
response.

Отсутствующая area/link/spawn/bot reference является ошибкой. Gryzl или
другой historical bot не подставляется как travel dest.

## WLD-01 — area transitions

### Architecture decision

Отдельный `ARC-WORLD` не нужен. `heroes.area_id` остаётся persisted location
на character (без `character_locations` и без переноса колонки в `world`).
World владеет authored graph: `world.areas` и новая `world.area_links`.
Travel lock — `character.heroes.move_ready_at` (`timestamptz`, `NULL` = можно
идти). Character и wire не читают world tables: только world ports.

ADR-0017…ADR-0020 достаточны: одна UoW на команду, typed static OA, content
через active release, fail-fast без fixture fallback. Presence `131:` /
`notifyAreaMove` — **RTM-01**. Hunt locks — **WLD-02**. Store lots / rank
gates / `store|*` — ECO-01/ECO-02 (raw-AMF; CEF не прогонялся). Dungeon/BG copies и `common|instance_conf` —
не этот срез.

Именованное `FightRules`: активный бой → COME_IN и `common|exit` дают
`status:203` `нельзя во время боя` (live `fightBusy`). Это не live-исключение
для PUT_ON; для travel live уже режет.

### Content set (`playable-slice/v12`)

Dump-proven subset, не весь L1–8 (это DATA-04 corpus):

| Area | Title              | `ftime_max` | `code`  | SWF / fight_bg                         |
| ---- | ------------------ | ----------- | ------- | -------------------------------------- |
| 503  | Горное поселение   | 0           | `""`    | `forestvillage.swf` / `2_1` (уже в v8) |
| 504  | Деревенская лавка  | 0           | `store` | `forestvillage.swf` / `2_1`            |
| 501  | Ущелье разлуки     | 15          | `""`    | `uschelierazluki.swf` / `2_1`          |
| 495  | Площадь Бранендаля | 0           | `""`    | `branendal_ploshad.swf` / `2_1`        |
| 552  | Арсенал            | 0           | `store` | `branendal_ploshad.swf` / `2_1`        |

Provenance: `radvei_areas.json` + `AREA_SIDEBAR.md`. Не публиковать 498, 502,
542, NPC `href`, AREA-attack (Грызл/Хисса), dungeon items.

Authored **travel links only** (sidebar `(flags & 0x10) == 0`):

| from | item `id` | title              | flags | `direction` | to  |
| ---- | --------- | ------------------ | ----- | ----------- | --- |
| 503  | 5         | Деревенская лавка  | 8     | 0           | 504 |
| 503  | 7         | Ущелье разлуки     | 0     | 2           | 501 |
| 501  | 2         | В Горное поселение | 0     | 1           | 503 |
| 504  | 0         | `""`               | 0     | 0           | 503 |

Картинки/описания — как в dump (`?ux=` оставлять). `href` всегда
`{ object:"common", action:"action", form:{ code:"COME_IN", area_id:<number> } }`.
`to_id` — строка dest. `confirm_question` — `""`.

`parent_id`: 504 → `"503"`; 552 → `"495"`; 501, 503 и 495 → `""` (dump `498`
не в slice; dump parent **494** площади тоже нет в `radvei_areas.json`
`areas` keys — это gap, не relocated shop). Walk 503→495/552 нет. ECO-02
публикует dump-двери 495 item 238 flags 16 → 552 и 552 item 0 exit → 495;
e2e Арсенала ставит area через `characterLocation.setArea`, не COME_IN из
деревни. Скаляры, которых нет в `radvei_areas` (sounds,
`context`, channel flags): пустые строки / `0`. Не копировать village
ambience 503 на 501/504. `client_data` остаётся `""`. Hunt на 501/504 — пустой
массив, не подставлять 50310.

Невалидная ссылка (to-area нет в bundle, link с NPC href, parent не в
release) отклоняет весь candidate release.

### Persistence

- `character.heroes.move_ready_at timestamptz NULL`;
- `world.areas.parent_id text NOT NULL` (пустая строка = нет родителя в slice);
- `world.area_links(release_id, from_area_id, item_id, to_area_id, title,
picture, description, flags, direction)` PK `(release_id, from_area_id, item_id)`;
  FK на `areas` той же release для from и to.

Схема: `0000_foundation_init` (имена осмысленные, Drizzle Kit). JSONB для
items запрещён.

### Public ports

World:

- `area(id)` — уже есть; неизвестная area — ошибка;
- `linksFrom(areaId)` — authored travel rows для `area_conf.items`;
- `requireLink(fromAreaId, toAreaId)` — нет ребра → доменный deny, не lookup
  «как live по голому area_id».

Character, тот же UoW:

- `setArea({ characterId, areaId, moveReadyAt })` — lock hero; `areaId`
  непустой; `moveReadyAt` `Date | null`;
- Hero несёт `moveReadyAt`; injected `Clock` как CHR-02, не `Date.now()` в
  domain.

Inventory: `bagLoad({ characterId })` (INV-02). Overload:
`amount > amountMax` (20/20 ходит).

Combat: `activeFightId` / `requireNoActiveFight`.

Orchestration в OA command (как INV-04 USE): fight → bagLoad → world link/area
→ `syncResources` → `setArea`. World не пишет `heroes`. Character не валидирует
граф.

### Wire

**COME_IN** — `common|object` / `common|action`, `form.code=COME_IN`,
`form.area_id` number/string. Registry `common|object:COME_IN`. Успех **flat**:

- `common|action` `{ action: "COME_IN" }` (без `msg_text`);
- `common|area_conf` (dest, `items` = linksFrom dest, `area_ftime` remaining);
- `common|hunt`;
- `state`, `user|unitframe`, `user|skills`;
- `chat|area_population` — полный roster dest area (RTM-01), не chrome empty.

Не добавлять `common|instance_conf`, farm piggyback, presence announce.

**`common|exit`** — ключ и success block `common|exit` `{ status:100 }`, не
`common|action`. Только интерьер: `area.code` непустой (в slice `store`) и
`parent_id` указывает на опубликованную area. Таймер **не** ставится
(`move_ready_at` не трогать). Outdoor / пустой code / нет parent → **204**
`Перемещение невозможно!`.

`area_ftime` = оставшиеся целые секунды до `move_ready_at` (0 если `NULL` или
истекло). Сейчас mapper врёт `0` всегда — исправить и в init2.

Таймер после успешного COME_IN:

```
ftime = floor( dest.ftimeMax * (100 - SPEED) / 100 )
move_ready_at = ftime > 0 ? clock.now() + ftime seconds : null
```

SPEED в slice нет → **0**, `ftime = dest.ftimeMax`. Формулу не выкидывать.
`ftime_max=0` (503, 504) сбрасывает lock в `NULL`. Повторный COME_IN/exit пока
lock жив → **204**
`Подождите! Дальнейшее перемещение станет возможным по истечении N&nbsp;с..`
(`N = max(1, ceil(remaining))`). Fail envelope без area_conf piggyback.

Перегруз → **204** `Вы не можете перемещаться, т.к. рюкзак перегружен!`.
Нет ребра from→to или dest не published → **203** `некуда идти` (строже live
`resolveComeIn`, который доверяет голому `area_id`). Нет `area_id` в form →
то же. Вход в `code=store` **без** `assertStoreEntry` (ECO-01/ECO-02: нет
LEVEL requires в 504/552 JSON).

### Restart / clock / concurrency

`area_id` и `move_ready_at` переживают process restart. FakeClock: advance на
15s снимает lock 501; ранний COME_IN остаётся 204. Hero row lock в UoW.
Эфемерных travel leases нет.

### Out of scope

RTM-01 presence/`131:`; WLD-02 hunt movement/locks; NPC
dialog; AREA `action_id` hunt from menu; 502+; `parent_id` 498; `client_data`
blobs; SPEED с экипа/маунта; dungeon/BG.

### Acceptance

- unit: ftime formula SPEED=0; wait error `&nbsp;`; overload `amount>amountMax`;
  outdoor exit deny; missing link deny;
- raw-AMF: 503→504 shop, `common|exit`→503 без lock; 503→501 `area_ftime=15`,
  clock +15s, обратно в 503; ранний 204 wait; 21 weighted bag rows → 204
  overload (отдельные bag-слоты, не один стак 93); 20/20 ходит; fight 203;
  502/unlinked 203 `некуда идти`; outdoor exit 204; reconnect/init2 dest +
  sidebar items;
- CEF: сайдбар 503 «Деревенская лавка» и «Ущелье разлуки»; вход/выход лавки;
  ущелье и таймер/возврат; reconnect на dest. Покупка в лавке не требуется;
- нет fake OA; нет Gryzl-as-travel; runtime не читает `radvei_areas.json`.

## Hunt lifecycle — WLD-02

### Architecture decision

Отдельный `ARC-*` не нужен. Ephemeral hunt overlay живёт в process memory
модуля `world` (как active combat): текущие `position`/`prev`, `fight_id`,
lock owner. Authored `world.hunt_spawns` не пишется. Таблицы `hunt_locks` /
`spawn_leases` нет — live Postgres lock + `clearAllHuntLocks` на старте для
j-emu лишний: один процесс, бой и так RAM.

Restart процесса: overlay пуст, точки снова authored home, `fight_id=0`;
`heroes.area_id` не трогать.

Clock injected. Wander/respawn — **WLD-03**.

### Content

WLD-02 срезал только **50310** (artikul 2, mask `bot_1`, home 883/1499) без
`zone`/`route`/`respawn`. Текущий slice и wander — **WLD-03**.

Wire `common|hunt.bots[]` только клиентские поля: `id`, `artikul_id`,
`fight_id`, `hunt_mask`, `position_x/y`, `prev_x/y`. Idle `fight_id=0`
(уже `IDLE_HUNT_FIGHT_ID`).

### ATTACK_BOT

Карта шлёт `form.bot_id` = **spawn id** (`50310` = `common|hunt.bots[].id`),
не catalog artikul `2`. Нет спавна → `203`. Не маппить `2`→`50310`. Меню
AREA `action_id` / `quest_bot_artikul` — не этот срез.

Свободная точка: `nextFightId` → `tryAcquireSpawn` → `startHunt`. Занятая
живая точка (`overlay.fightId` + RAM battle): **тот же** OA ATTACK_BOT
идёт в `joinHunt(..., team=1)`. Клиент `BotAlt` при `FightID > 0` всё равно
шлёт ATTACK_BOT. Evidence: `lifecycle.ts` `interveneJoin` /
`startFight` occupied branch; [FIGHT_JOIN.md](../../../jgr-emu/docs/FIGHT_JOIN.md)
«Intervene с карты». `SYNC.md` «второй ATTACK → 203» — устаревшая схема.

Успех join — тот же flat, что старт: `common|action` 100, `fight|conf`
(**тот же** `fightId`/`fightAkey`, **свой** `userId` = `heroes.id`),
`common|hunt`, `state`, `user|unitframe`. Не выдавать новый fight id и не
перезаписывать overlay.

Первый боец уже держит бота → joiner в queue своей team, bootstrap с
`oppwait` (без `attacknow`). Остальным authed humans — fproxy roster
(`persList` + `persChangeInfo`), не полный re-bootstrap. Re-pair waiter
после смерти союзника — CMB-01 (сделано); CMB-08 waiter-handoff после
3↔3 hits (сделано). Cross-swap двух живых пар — leftover CMB-08.

Отказ join через ATTACK_BOT — **203** + `error` (`notPossible`), не 204:
`уже в бою`, `бой не найден`, `бой в другой локации`,
`вы уже участвовали в этом бою`. 204 — только будущие OA FIGHT_JOIN /
FIGHT_HELP. Квестовых боёв нет. Ghost/injury — CMB-04 character, не hunt
join.

«моб уже занят» в live — текст `acquireHuntLock`, но ATTACK_BOT сразу
делает `interveneJoin`, если есть `lock.fightId`. В j-emu: busy overlay
без RAM battle = stale → `releaseSpawn` и обычный `startHunt`. Не
оставлять 203 на живом `fight_id`.

### Ports

World:

- `tryAcquireSpawn({ areaId, spawnId, fightId, ownerAccountId })` —
  occupied живым боем → `{ ok:false, reason:"busy", fightId }`; тот же
  owner может обновить fightId;
- `occupiedFightId(areaId, spawnId)`;
- `releaseSpawn({ areaId, spawnId })`;
- `huntSnapshot(areaId)` — wire bots с live overlay и wander (без записи в content).

Combat: `startHunt` после успешного acquire; `joinHunt` на существующий
fight id (второй human team 1, тот же access key). `hasFight` отличает
живой RAM battle от stale overlay. Release overlay на terminal
`takeExit` / finish / process drop — composition observer.

После acquire/release/join: fan-out 131 hunt через существующий esrv poll
и `LongPollCoordinator.wake`. Lock freeze (WLD-03): пока busy, xy на
текущей интерполяции сегмента, не на authored home.

### Out of scope

Wander/route/respawn — **WLD-03**. Pub1 `.map` polygons; dungeon copies;
quest/menu attack; OA `FIGHT_JOIN` / `FIGHT_HELP`; loot; hunt cross-swap
двух 3↔3 пар.
Не копировать live `10_000_000 + heroes.id` в `userId`.

### Acceptance

- unit: acquire/busy(+fightId)/release; stale overlay without battle;
  snapshot `fight_id`; missing spawn;
- raw-AMF: A ATTACK_BOT 50310 → hunt.bots[50310].fight_id = fight id;
  B тот же spawn → 100, тот же fightId/akey, userId B; 131 остаётся busy;
  A poll видит B в persList; B auth → oppwait пока A в дуэли с ботом;
  B уже в бою / другой area → 203; finish/exit → idle 0; restart → idle,
  `area_id` героя тот же;
- CEF: клик Грызла занимает точку; второй клиент на ту же точку входит в
  тот же бой, не стартует второй;
- нет fake OA; runtime не читает `hunt_spawns.json`.

## Hunt wander — WLD-03

### Architecture decision

Отдельный `ARC-*` не нужен. ADR-0017–0020 достаточны. Authored route/zone/
wait/respawn живут в `world.hunt_spawns` (immutable release). Live motion —
тот же process-local overlay, что WLD-02: `HuntWanderRuntime` + общий
`DelayScheduler` (тот же instance, что CMB-01 melee), не per-spawn
`setInterval`. RNG injected (`HuntRandom`); `Math.random` нет.

Скрытый respawn (`hiddenUntil`) опускает бота из `common|hunt.bots[]`.
Lock freeze: текущая интерполяция сегмента. Finish/release →
`hideForRespawn` по authored `respawn_time_*` (нули = сразу home). Restart
процесса: motion сбрасывается на authored home, как overlay.

Catalog `bots.hunt_speed` читается join'ом на snapshot; speed 10 → 20 px/s,
пол `4` px/s — именованная walk policy live Flash.

### Content

Representative dump-proven, не полный `hunt_spawns.json` (DATA-04):

- **50310** home park: пустые `zone`/`route`, respawn 0 — не выдумывать
  маршрут 50309;
- **50309** route + respawn 3–15s (Hissa `4` на 503);
- **50101–50103** zone + wait 2–6s.

Не публиковать 50311–13.

### Acceptance

- unit: home park; route first stop; zone dest ≠ home; lock freeze;
  hidden omit; route+zone fail-fast;
- raw-AMF: init 50309 `prev` home → `position` first stop; после walk
  due оба xy на stop; 50310 остаётся 883/1499;
- нет per-spawn `setInterval`; runtime не читает `hunt_spawns.json`.

## Presence и channels — RTM-01

### Architecture decision

Отдельный `ARC-RTM` не нужен. ADR-0017 достаточны: durable outbox table не
создаём «на будущее». Social-модуля нет; party `4:` — [PARTY.md](PARTY.md)
(SOC-02). `chat|add` —
[CHAT.md](CHAT.md) (SOC-01).

**Roster (gameplay state)** — PostgreSQL: `identity.sessions` ⨝
`character.heroes.area_id`. Кто онлайн в локации переживает restart процесса.
Нет `presence_leases` и нет world-owned location table.

**Delivery (transport)** — process-local per-account queue в `jugger-wire`.
Потеря при restart допустима: клиент на init2/reconnect получает полный
`chat|area_population`. Это именованная политика, не fallback live Map.

**Каналы (live `esrv.ts`):**

| Канал           | RTM-01                                                            |
| --------------- | ----------------------------------------------------------------- |
| `2:<accountId>` | `chat\|area_population_diff` add/remove другим в той же area      |
| `131:<areaId>`  | каждый poll: `common\|hunt` snapshot текущей area (WLD-03 wander) |
| `4:<partyId>`   | нет                                                               |

Population **diff** едет на личный `2:` (live `enqueueEsrv` без `__channel`).
Полный roster — OA `chat|area_population` `{ status:100, population:[...] }`,
не chrome empty. `instance_id` всегда `0` (копий нет).

`jugger-wire` не считает presence: world/application отдаёт typed notify +
roster DTO; wire кодирует packet `{ channel, ctime, object }`. Fastify long-poll
остаётся adapter. Per-account wake — `LongPollCoordinator.wake(accountId)`.

Post-commit: enqueue и wake **после** UoW travel/login/logout, не внутри
транзакции.

### CharacterInfo wire

Dump-proven поля live `presence.ts` `buildCharacterInfo`:

`id` = **accountId** (не `heroes.id`), `nick`, `level`, `kind`,
`instance_id: 0`, `dead: 0|4`, `injury_time`, `injury_artikul_id`,
`body`, `sk`, `avatar_small` из appearance catalog.

Ghost: `dead:4`, `injury_time`/`injury_artikul_id` с героя (875 / unix+600).
Живой roster держит нули, не omit. Экип в roster не пушить. `change` (level/ghost) не слать,
пока нет consumer-сценария в срезе.

Logout / `replaceForAccount` (новая сессия вытесняет старую): remove в старой
area, если сессии больше нет. Login / session create: add соседям.

COME_IN/`exit` после `setArea`: remove в from, add в to (если from≠to).

### Chat auth

`{rc:"auth", eid:1, ...}` на `/esrv/*` — HTTP пустое тело, не MULTI
([WIRE_INVARIANTS.md](../migration/WIRE_INVARIANTS.md)).

### Out of scope

party `4:`; OA `FIGHT_JOIN` / `FIGHT_HELP`; ghost/injury change; playerbots; dungeon/BG shards; transactional
outbox; durable cursors.

### Acceptance

- два `createIsolatedHero` на 503: init2 `population` содержит обоих;
- A COME_IN 504: B на esrv получает `2:` diff `remove` (nick/id A); A init2 на
  504 без B; возврат `exit` → B видит `add`;
- logout A → B `remove`;
- каждый poll после auth несёт MULTI-кадр `131:<areaId>` с `common|hunt`;
- chat auth → пустой body;
- restart процесса: очередь пуста, init2 roster снова из sessions;
- нет fake OA, нет bot shortcuts.

## Acceptance будущей полной world wave

- два героя согласованно видят roster и hunt busy;
- concurrent attack имеет одного победителя;
- restart очищает ephemeral locks и сохраняет hero area;
- transition и hunt responses совпадают с legacy wire;
- runtime читает world только из active release.
