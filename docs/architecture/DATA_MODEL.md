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
`drizzle/0002_world_location_scalars`, `drizzle/0003_character_bootstrap_state`,
`drizzle/0004_catalog_artifact_wear_and_equipment_slot`,
`drizzle/0005_character_experience_progression`,
`drizzle/0006_character_hp_regeneration`,
`drizzle/0007_catalog_artifact_bag_economy`,
`drizzle/0008_inventory_pocket_position_unique`,
`drizzle/0009_catalog_artifact_actions`,
`drizzle/0010_character_move_ready_at`,
`drizzle/0011_world_area_links`,
`drizzle/0012_catalog_bot_fight_look`,
`drizzle/0013_catalog_artifact_extra`,
`drizzle/0014_catalog_bot_loot`,
`drizzle/0015_character_ghost_injury`.
Поля ниже совпадают с runtime.

### `identity`

- `accounts(id integer GENERATED ALWAYS AS IDENTITY START 1, login UNIQUE, nick UNIQUE, password_hash, created_at)`.
- `sessions(id text PK, account_id UNIQUE integer, session_key, created_at)`.

Ник дублируется на `character.heroes` для текущего bootstrap. Отдельных
`account_credentials` / `operator_roles` нет.

### `character`

- `heroes(id integer GENERATED ALWAYS AS IDENTITY START 1, account_id UNIQUE,
nick, level, hp, max_hp, mp, max_mp, exp, area_id, money_minor,
money_gold_minor, kind, gender, language, body, sk, honor, hp_time, regen_at timestamptz, move_ready_at timestamptz NULL, ghost boolean, injury_time bigint, injury_artikul_id integer, version)`.
- `hero_personal_details(hero_id PK FK → heroes ON DELETE CASCADE, info jsonb, schema_version=1)`.
- `hero_skills(hero_id FK → heroes ON DELETE CASCADE, skill_id, value)` с PK
  `(hero_id, skill_id)`.
- `experience_grants(hero_id, operation_id, amount, exp_before, exp_after,
level_before, level_after, content_release_id, progression_digest, created_at)`
  с PK `(hero_id, operation_id)`, FK на `heroes` и `content.releases`;
  `operation_id` 1…128, `amount > 0`. Persisted exactly-once result для
  `grantExperience`, не combat state.

`area_id` — текстовая ссылка на authored area; FK на `world.areas` в этом срезе
нет. `move_ready_at` — travel lock (NULL = можно COME_IN/`exit`) на том же
`heroes` row, без `character_locations`. `info` — sparse wire-объект `user|personal_details.info` / form
`user|save_personal_details`. Строка обязательна для каждого героя; её
отсутствие является ошибкой целостности, а не пустым объектом. Merge пишет
целиком, без `jsonb_set`. HP/MP/EXP и naked max values хранятся скалярами героя,
naked skills — отдельными строками `hero_skills`. `hp_time` — remaining seconds
до полного HP; `regen_at` — unix-second truncated timestamp ленивого регена.
`ghost` / `injury_time` / `injury_artikul_id` — CMB-04; SQL DEFAULT только для
старых строк, runtime пишет явные значения. Репутации ещё нет.

### `inventory`

- `item_id_seq`: `MIN 100_000` `MAX 2_147_483_647` `NO CYCLE` (не пересекаться с native/glove `persSpells.srcId`). [ID_POLICY.md](ID_POLICY.md), [ID_RANGES.md](../../../jgr-emu/docs/ID_RANGES.md).
- `items(id bigint DEFAULT nextval, hero_id integer, artifact_id, quantity, location_kind, pocket_position, equipment_slot, version)`.

`location_kind` ∈ `bag|pocket|equipment` с CHECK взаимоисключения slot-колонок.
Частичный unique `(hero_id, equipment_slot) WHERE location_kind = 'equipment'`.
Частичный unique `(hero_id, pocket_position) WHERE location_kind = 'pocket'`
(`0008_inventory_pocket_position_unique`). Отдельных containers/reservations нет.

### `catalog`

Versioned projection активной content release:

- `artifacts(release_id, id, title, picture, type_id, kind_id, slot_mask, weight,
level_min, level_max, gender, price_minor, flags, bag_stack, skills jsonb,
artifact_actions jsonb, extra jsonb)`
  PK `(release_id, id)`. `price_minor` — integer cents ≥ 0 (`0` валиден);
  `flags` integer ≥ 0; `bag_stack` integer ≥ 1; `artifact_actions` — typed map
  (пустой объект = нет USE). `extra` — dump-proven fight blobs (`spell`,
  `spells`/`hits` на 9095); пустой объект валиден (еда 77).
- `bots(release_id, id, title, level, max_hp, strength, hunt_nick, hunt_swf,
hunt_scale, hunt_fps, hunt_speed, hunt_avatar, hunt_kind, hunt_hide_on_map,
hunt_sk, hunt_body, base_exp, money_min, money_max, loot_drop_cnt,
loot_bonus_chance, loot_bonus_min, loot_bonus_max, loot_nothing_weight)`
  PK `(release_id, id)`. Map hunt uses swf/avatar; fight `oppnew` uses
  `hunt_sk`/`hunt_body`/`hunt_avatar` (Gryzl live: sk `"11"`, body `""`).
  Reward scalars — overlay Gryzl bot 2; `loot_nothing_weight` = 3000 + сумма
  unpublished overlay entry weights.
- `bot_loot_entries(release_id, bot_id, artikul_id, drop_weight, count_min,
count_max)` PK `(release_id, bot_id, artikul_id)`; FK на `bots` и `artifacts`
  той же release. Published Gryzl entries: 77, 93, 99.
- `skill_definitions(release_id, id, title, group_key, sort_order, weight,
image, value_kind)` PK `(release_id, id)`.
- `level_boundaries(release_id, level, exp_min, exp_max, bag_cnt, honor_rank,
honor_min, honor_max, honor_status)` PK `(release_id, level)`.
- `level_skill_values(release_id, level, skill_id, value, evidence_kind,
source_digest)` PK `(release_id, level, skill_id)`; FK на boundary и
  `skill_definitions` той же release. Managed naked values L1–L8, не runtime
  formula.
- `appearance_presets(release_id, kind, gender, avatar_big, avatar_small)` PK
  `(release_id, kind, gender)`.
- `game_wide_documents(release_id, document_key, document jsonb)` PK
  `(release_id, document_key)`; допустимые ключи: `hud_defaults`, `chrome`,
  `common_conf`, `welcome_message`.

Отдельных spell-таблиц нет: fight spell живёт в `artifacts.extra`.
`common|conf`, empty chrome и HUD defaults читаются из
`catalog.game_wide_documents` активной release; level/appearance metadata — из
versioned catalog tables той же release. Исходные bootstrap-файлы являются
import input publication pipeline, а не runtime source gameplay-запроса.
Chat/menu links пока остаются в обязательной game policy.

Migration `0003_character_bootstrap_state` добавила persisted hero state,
`hero_skills` и bootstrap catalog projection. Migration
`0004_catalog_artifact_wear_and_equipment_slot` добавила wear constraints и
`skills` artifact-а, а также unique occupancy equipment slot. Equipment totals
считаются из naked `hero_skills` и `artifacts.skills`; это derived read/mutation
state, не отдельная таблица. Migration
`0005_character_experience_progression` добавила `experience_grants` и
normalized `level_skill_values`. Hero creation читает L1 из pinned progression
snapshot; policy хранит только EXP 1 и misc skills.

### `world`

- `areas(release_id, id, title, parent_id, map_asset, fight_background, region_map,
ftime_max, code, context, sound_intro, sound_bg, inst_artikul_id,
have_trade_channel, have_kind_channel, hide_finished_fights,
hide_running_fights, no_clan_chat)` PK `(release_id, id)`.
  `parent_id` — пустая строка = нет родителя в slice. `map_asset` — SWF большой карты (`area_conf.swf`). Скалярные поля wire —
  колонки. `client_data` и `hunt_farm` mapper собирает пустыми. `area_conf.items`
  собираются из `world.area_links`.
- `area_links(release_id, from_area_id, item_id, to_area_id, title, picture,
description, flags, direction)` PK `(release_id, from_area_id, item_id)`;
  FK from/to `areas` той же release. Не JSONB.
- `hunt_spawns(release_id, id, area_id, bot_id, position_x, position_y, hunt_mask)`
  PK `(release_id, id)`; FK на `areas` и `catalog.bots` в той же release.
  `id` — authored integer `area × 100 + index` (для Gryzl на 503 — `50310`).

`position_x/y` — authored map coordinates (`double precision`). Presence leases
нет: roster считается из sessions. Spawn overlay WLD-02 process-local, не
таблица. Текущая локация героя — `heroes.area_id`.

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
[ADR-0020](../adr/ADR-0020-ephemeral-combat.md).

### `content`

- `drafts(id, content_type, content_key)` UNIQUE `(content_type, content_key)`;
  текущий `content_type` ∈ `artifact|bot|area|area_link|hunt_spawn|skill|level|appearance|
hud_defaults|chrome|common_conf|welcome_message`.
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

Mana regen (`MPREG`/`mp_time` formula), reputations и расширенная statistics
model остаются планом. `heroes.ghost` / `injury_time` / `injury_artikul_id`,
`heroes.regen_at`, `hp_time`, `experience_grants`, `hero_skills`, HP/MP/EXP
и appearance bootstrap уже находятся в runtime.

### `inventory`

containers, item_modifiers, container_slots, equipment_slots, item_reservations.

### `catalog`

item_actions, item_stat_modifiers, creature_stats/loot, spell_definitions,
level_curves — отдельные таблицы поверх текущих `artifacts`/`bots`.
`level_skill_values` уже в runtime и не является будущей таблицей.
`store_types` / `store_lots` — ECO-01 (ещё не созданы); owner catalog, не
economy.

### `world`

character_locations, presence_leases, spawn_leases, facts.

### `combat`

Durable sides/turns/effects, active participants и JSONB event log не
планируются. `arena|finished_fights` OA и `fight_info.php` в текущем срезе
не отдаются.

### `quests` / `social` / `economy` / `professions` / `instances`

Модулей в runtime нет. Целевые API — в [MODULES.md](MODULES.md). Схемы
появляются вместе с первым подтверждённым OA этого модуля.

Перед глобальным изменением границ character/inventory/world/combat или началом
economy/social/instances нужен отдельный architecture checkpoint: подтвердить
владельца данных, public ports, transaction/saga boundary и restart/concurrency
semantics для выбранного vertical slice. Процесс и gates задаёт
[ROADMAP.md](../migration/ROADMAP.md), повторяемый workflow —
[PLAYBOOK.md](../migration/PLAYBOOK.md); checkpoint не является разрешением
заранее придумывать таблицы.

## Политика JSONB

JSONB запрещён по умолчанию. В текущем срезе он есть только в:

1. `content.draft_versions.document` — immutable authoring document;
2. `combat.finished_fights.teams` — immutable validated snapshot старого
   `finished_fights.teams` wire DTO для history/info;
3. `character.hero_personal_details.info` — sparse client prefs (`Chat.*`,
   `pondViewLast`, `tutorial2`, …). Владелец: `character`. Версия:
   `schema_version=1`. Validation до записи: JSON object, конечные числа,
   без функций/bigint, лимит 16384 байт. Partial update через `jsonb_set`
   запрещён: read → merge → write целого объекта;
4. `catalog.artifacts.skills` — validated immutable bonuses конкретной release;
5. `catalog.game_wide_documents.document` — validated immutable
   `hud_defaults`/`chrome`/`common_conf`/`welcome_message` конкретной release.

Для каждого JSONB обязательны владелец, версия, validation до записи, лимит
размера и запрет частичных business-update через `jsonb_set`. Если ключ
участвует в ограничениях, join, сортировке или деньгах — это колонка.

## Read model для `init/init2`

`BootstrapReadModel` собирает typed snapshot через application ports, не через
общий SQL join всех модулей. `jugger-wire` переводит snapshot в плоские
`init/init2` и `state`. Отсутствие обязательного hero/content — ошибка. Готовый
AMF не хранится как источник истины. Отдельная persisted bootstrap projection
не вводится до измеренного узкого места.
