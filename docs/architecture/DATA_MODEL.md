# Модель данных

## Общие решения

- Один PostgreSQL; таблицы описываются Drizzle schema files владельца.
  PostgreSQL schema группирует таблицы модуля и не делает из модуля сервис.
- Persisted runtime ID выдаёт только БД через identity/sequence/default.
  Authored catalog ID сохраняется из опубликованного контента. Wire-видимые
  диапазоны — в [ID_POLICY.md](ID_POLICY.md).
- Время — `timestamptz`. Unix time появляется только в `jugger-wire`.
- Деньги текущего среза — целое `money_minor` на герое (`bigint`), не
  `double precision`. `numeric(20,2)` с кодом валюты — план для `economy`.
- Счётчики и количество — integer/bigint с `CHECK`.
- Используются FK, unique/check constraints и `ON DELETE` по смыслу.
- `operation_id` добавляется только для команд, которые реально могут быть
  повторены транспортом или background worker.
- Outbox/inbox не копируются в каждый модуль заранее.

Playerbot-таблиц и признаков `is_bot` нет.

## Текущий playable slice

Источник истины — Drizzle schema files в `src/modules/*/infrastructure/schema.ts`
и цепочка `drizzle/0000_foundation_init`, `drizzle/0001_character_add_hero_personal_details`,
`drizzle/0002_world_location_scalars`.
Поля ниже совпадают с runtime.

### `identity`

- `accounts(id integer GENERATED ALWAYS AS IDENTITY START 1, login UNIQUE, nick UNIQUE, password_hash, created_at)`.
- `sessions(id text PK, account_id UNIQUE integer, session_key, created_at)`.

Ник дублируется на `character.heroes` для текущего bootstrap. Отдельных
`account_credentials` / `operator_roles` нет.

### `character`

- `heroes(id integer GENERATED ALWAYS AS IDENTITY START 1, account_id UNIQUE, nick, level, hp, max_hp, area_id, money_minor, version)`.
- `hero_personal_details(hero_id PK FK → heroes ON DELETE CASCADE, info jsonb, schema_version=1)`.

`area_id` — текстовая ссылка на authored area; FK на `world.areas` в этом срезе
нет. `info` — sparse wire-объект `user|personal_details.info` / form
`user|save_personal_details`. Нет строки = пустой объект; merge пишет целиком,
без `jsonb_set`. Ресурсы, навыки и репутации не выделены.

### `inventory`

- `item_id_seq`: `MIN 100_000` `MAX 2_147_483_647` `NO CYCLE` (не пересекаться с native/glove `persSpells.srcId`). [ID_POLICY.md](ID_POLICY.md), [ID_RANGES.md](../../../jgr-emu/docs/ID_RANGES.md).
- `items(id bigint DEFAULT nextval, hero_id integer, artifact_id, quantity, location_kind, pocket_position, equipment_slot, version)`.

`location_kind` ∈ `bag|pocket|equipment` с CHECK взаимоисключения slot-колонок.
Отдельных containers/reservations нет.

### `catalog`

Versioned projection активной content release:

- `artifacts(release_id, id, title, picture, type_id, kind_id, slot_mask, weight)` PK `(release_id, id)`.
- `bots(release_id, id, title, level, max_hp, strength, hunt_nick, hunt_swf,
hunt_scale, hunt_fps, hunt_speed, hunt_avatar, hunt_kind, hunt_hide_on_map)`
  PK `(release_id, id)`. Hunt look — спрайт на карте (`area_conf.hunt_bots`),
  не fight `sk`/`body`.

Spell/loot/level-curve таблиц нет. Game-wide `common|conf` в этом срезе — не
таблица, а обязательный файл `content/common-conf.json` (путь
`bootstrap.commonConfFile`). Ключи совпадают с live dump; отсутствие файла или
ключа — ошибка startup.

HUD-константы `user|unitframe` (mp/exp/honor/avatar), которых нет на `heroes`,
лежат в `bootstrap.unitframe` game policy, не в отдельной таблице.
Paperdoll/chat/menu_links — `bootstrap.view` / `bootstrap.chat` /
`bootstrap.menuLinks` (значения jgr-emu `DEFAULT_BODY`, `buildChatConf`,
seed `menu_link_status`).

### `world`

- `areas(release_id, id, title, map_asset, fight_background, region_map,
ftime_max, code, context, sound_intro, sound_bg, inst_artikul_id,
have_trade_channel, have_kind_channel, hide_finished_fights,
hide_running_fights, no_clan_chat)` PK `(release_id, id)`.
  `map_asset` — SWF большой карты (`area_conf.swf`). Скалярные поля wire —
  колонки. `items`, `client_data` и `hunt_farm` mapper собирает пустыми, пока
  нет дочерних таблиц.
- `hunt_spawns(release_id, id, area_id, bot_id, position_x, position_y, hunt_mask)`
  PK `(release_id, id)`; FK на `areas` и `catalog.bots` в той же release.
  `id` — authored integer `area × 100 + index` (для Gryzl на 503 — `50310`).

`position_x/y` — authored map coordinates (`double precision`). Presence, area
links и spawn leases не выделены. Текущая локация героя — `heroes.area_id`.

### `combat`

Active state хранится только в process-local `CombatService`. Таблицы active
fights, participants, turns, effects, packets, checkpoints и events отсутствуют.

PostgreSQL хранит одну строку завершённого результата по контракту старого
`jgr-emu.finished_fights`:

- identity: `id` = выданный `combat.fight_id_seq` (не отдельный identity),
  `account_id` / `hero_id` — integer FK на identity/character;
- wire history: `title`, `type`, `timeout`, `level_min`, `level_max`, `level`,
  `ml_title`, `winner`, `started`, `duration`, validated `teams jsonb`;
- query/retention: `area_id`, `finished_at timestamptz`.

`teams.1[].id` — numeric `heroes.id`. Bot member хранит authored `artikul_id`;
RAM fight bot ID в history не пишется. Storage нормализует `teams_json` →
`jsonb`, unix-ms → `timestamptz`, duration/winner → integer.

History не является source of truth для rewards, quests, HP или inventory.
Повторная запись идентичного результата идемпотентна; тот же fight ID с
другими данными — диагностируемая ошибка. Ошибка history не прерывает
terminal combat packets (явная best-effort policy). Retention 72 часа;
cleanup — single-flight bounded batches по индексу `finished_at`, не на
finish/read request path. Полный контракт:
[ADR-0015](../adr/ADR-0015-ephemeral-combat-and-finished-history.md).

### `content`

- `drafts(id, content_type, content_key)` UNIQUE `(content_type, content_key)`;
  `content_type` ∈ `artifact|bot|area|hunt_spawn`.
- `draft_versions(id, draft_id, version, schema_version, document jsonb, created_at)`.
- `releases(id, version UNIQUE nextval, checksum UNIQUE, schema_version, validator_version, created_at, activated_at)`.
- `release_entries(release_id, content_type, content_key, draft_version_id, digest)`.
- `active_release(lock_id=1, release_id, activated_at)` — singleton pointer.
- `bootstrap_imports(digest PK, release_id, source, applied_at)`.

Публикация — [CONTENT_PIPELINE.md](CONTENT_PIPELINE.md).

## План (не в runtime)

Таблицы ниже не созданы и не являются baseline. Их нельзя добавлять «на будущее»
без вертикального среза.

### `character`

skills, resources, reputations, statistics, appearance.

### `inventory`

containers, item_modifiers, container_slots, equipment_slots, item_reservations.

### `catalog`

item_actions, item_stat_modifiers, creature_stats/loot, spell_definitions,
level_curves — отдельные таблицы поверх текущих `artifacts`/`bots`.

### `world`

area_links, character_locations, presence_leases, spawn_leases, facts.

### `combat`

Durable sides/turns/effects, active participants и JSONB event log не
планируются. `arena|finished_fights` OA и `fight_info.php` в текущем срезе
не отдаются.

### `quests` / `social` / `economy` / `professions` / `instances`

Модулей в runtime нет. Целевые API — в [MODULES.md](MODULES.md). Схемы
появляются вместе с первым подтверждённым OA этого модуля.

## Политика JSONB

JSONB запрещён по умолчанию. В текущем срезе он есть только в:

1. `content.draft_versions.document` — immutable authoring document;
2. `combat.finished_fights.teams` — immutable validated snapshot старого
   `finished_fights.teams` wire DTO для history/info;
3. `character.hero_personal_details.info` — sparse client prefs (`Chat.*`,
   `pondViewLast`, `tutorial2`, …). Владелец: `character`. Версия:
   `schema_version=1`. Validation до записи: JSON object, конечные числа,
   без функций/bigint, лимит 16384 байт. Partial update через `jsonb_set`
   запрещён: read → merge → write целого объекта.

Для каждого JSONB обязательны владелец, версия, validation до записи, лимит
размера и запрет частичных business-update через `jsonb_set`. Если ключ
участвует в ограничениях, join, сортировке или деньгах — это колонка.

## Read model для `init/init2`

`BootstrapReadModel` собирает typed snapshot через application ports, не через
общий SQL join всех модулей. `jugger-wire` переводит snapshot в плоские
`init/init2` и `state`. Отсутствие обязательного hero/content — ошибка. Готовый
AMF не хранится как источник истины. Отдельная persisted bootstrap projection
не вводится до измеренного узкого места.
