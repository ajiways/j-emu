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
и pre-baseline миграции `drizzle/0000_foundation_init.sql` плюс последующие
`drizzle/0001`…`0021`. Поля ниже совпадают с runtime.

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
- `hero_learned_bonuses(hero_id FK → heroes ON DELETE CASCADE, bonus_id, artikul_id)`
  PK `(hero_id, bonus_id)`; INV-08 skill books. `bonus_id > 0`, `artikul_id > 0`.
- `hero_reputations(hero_id FK → heroes ON DELETE CASCADE, object_id, value)`
  PK `(hero_id, object_id)`; `object_id > 0 AND <> 36`; `value >= 0`. Нет row = 0. SUM **36** не хранится.
- `experience_grants(hero_id, operation_id, amount, exp_before, exp_after,
level_before, level_after, content_release_id, progression_digest, created_at)`
  с PK `(hero_id, operation_id)`, FK на `heroes` и `content.releases`;
  `operation_id` 1…128, `amount > 0`. Persisted exactly-once result для
  `grantExperience`, не combat state.
- `honor_grants(hero_id, operation_id, amount, honor_before, honor_after,
rank, honor_min, honor_max, honor_status, content_release_id, created_at)`
  с PK `(hero_id, operation_id)`, FK на `heroes` (`ON DELETE CASCADE`) и
  `content.releases` (`ON DELETE RESTRICT`); `operation_id` 1…128,
  `amount > 0`, `honor_after >= honor_before`, `rank >= 0`,
  `honor_max >= honor_min`, `honor_status IN (0, 1)`. Persisted
  exactly-once result для `grantHonor` (HERO-01); clamp может оставить
  `added = 0` при `amount > 0`.

`area_id` — текстовая ссылка на authored area; FK на `world.areas` в этом срезе
нет. `move_ready_at` — travel lock (NULL = можно COME_IN/`exit`) на том же
`heroes` row, без `character_locations`. `info` — sparse wire-объект `user|personal_details.info` / form
`user|save_personal_details`. Строка обязательна для каждого героя; её
отсутствие является ошибкой целостности, а не пустым объектом. Merge пишет
целиком, без `jsonb_set`. HP/MP/EXP и naked max values хранятся скалярами героя,
naked skills — отдельными строками `hero_skills`. `hp_time` — remaining seconds
до полного HP; `regen_at` — unix-second truncated timestamp ленивого регена.
`ghost` / `injury_time` / `injury_artikul_id` — CMB-04; SQL DEFAULT только для
старых строк, runtime пишет явные значения. Репутация Радвея **5** — runtime
REP-01 (`hero_reputations` + derived SUM 36 на чтении). BOOK-01:
`hero_bot_kills(hero_id, bot_id, win_cnt)` PK, `win_cnt > 0`, bot_id = catalog
artikul; инкремент в hunt finish UoW. PRF-01:
`hero_professions(hero_id, profession_id, value)` PK, `value >= 1`.

### `inventory`

- `item_id_seq`: `MIN 100_000` `MAX 2_147_483_647` `NO CYCLE` (не пересекаться с native/glove `persSpells.srcId`). [ID_POLICY.md](ID_POLICY.md), [ID_RANGES.md](../../../jgr-emu/docs/ID_RANGES.md).
- `items(id bigint DEFAULT nextval, hero_id integer, artifact_id, quantity, location_kind, pocket_position, equipment_slot, durability, durability_max, upgrade_id, upgrade_level, upgrade_skill_id, upgrade_bound, expire, version)`.
  Instance `durability`/`durability_max` — INV-05, целые `>= 0`,
  `durability <= durability_max`. Overlay заточки — INV-06: `upgrade_id` ≥ 0,
  `upgrade_level` 0..6, `upgrade_bound` 0/1, `upgrade_skill_id` text; unupgraded
  xor upgraded CHECK. `expire` — INV-08 unix seconds ≥ 0, `NOT NULL` без SQL
  DEFAULT; drinks пишут `now+duration`, прочие create — `0`. Колонки `NOT NULL`
  без SQL DEFAULT; runtime пишет явные
  значения (unupgraded `0/0/''/0`, durability с catalog template) при create.

`location_kind` ∈ `bag|pocket|equipment|tempeffect` с CHECK взаимоисключения slot-колонок.
`tempeffect` — INV-07 kind-139 set bonus и INV-08 drinks: `quantity = 0`, оба slot-столбца NULL,
несколько строк на героя (unique слота нельзя). Paperdoll unique остаётся
`(hero_id, equipment_slot) WHERE location_kind = 'equipment'`.
Частичный unique `(hero_id, pocket_position) WHERE location_kind = 'pocket'`.
Отдельных containers/reservations нет.

### `catalog`

Versioned projection активной content release:

- `artifacts(release_id, id, title, picture, type_id, kind_id, slot_mask, weight,
level_min, level_max, gender, price_minor, flags, bag_stack, durability,
durability_max, skills jsonb, artifact_actions jsonb, extra jsonb)`
  PK `(release_id, id)`. `price_minor` — integer cents ≥ 0 (`0` валиден);
  `flags` integer ≥ 0; `bag_stack` integer ≥ 1; `durability` /
  `durability_max` integer ≥ 0, `durability <= durability_max` (`0`/`0` =
  не tracking). `artifact_actions` — typed map
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
  `skill_definitions` той же release. Managed naked values L1–L14, не runtime
  formula.
- `appearance_presets(release_id, kind, gender, avatar_big, avatar_small)` PK
  `(release_id, kind, gender)`.
- `game_wide_documents(release_id, document_key, document jsonb)` PK
  `(release_id, document_key)`; допустимые ключи: `hud_defaults`, `chrome`,
  `common_conf`, `welcome_message`.
- `store_types(release_id, area_id, type_id, title, ord)` PK
  `(release_id, area_id, type_id)`.
- `store_lots(release_id, area_id, lot_id, artikul_id, type_id, price, ord,
pay jsonb, requires jsonb)` PK `(release_id, area_id, lot_id)`; FK на
  `artifacts` и `store_types` той же release; `lot_id > 0`; `pay` not null
  (`gold` / `diamond` / `barter`); `requires` null = нет гейта. Slice: area
  504 type `-131` lots 80/23 и 82/24; area 552 type 11 lot 438/621 RANK min 4. Area проверяет publication, SQL FK на `world.areas` нет.
- `reputation_tracks(release_id, object_id, type, title, image, unlock_flag)`
  PK `(release_id, object_id)`; type 2; `object_id > 0 AND <> 36`. Slice:
  только Радвей **5**, empty unlock.
- `professions(release_id, id, title, type, skill_id, picture, position,
skill_step_override, skill_minlvl_override, description, info_url,
user_stat_id)` PK `(release_id, id)`; type 1 or 2; id 1…16; slice ids 2 and 6.
- `assistant_types(release_id, id, title, description, profession, level,
quality, next_artikul_id, skill_sum, price, price_type, picture,
restrictions_xml, voodoo_energy)` PK `(release_id, id)`; slice **3** and **13**.
- `farm_resources(release_id, id, title, type_id, picture, swf, quality,
profession, artifact_artikul_id, mastery_value, mastery_max, farm_time,
stamina_drain)` PK `(release_id, id)`; slice **4** → artifact **1720**.
- `area_farms(release_id, area_id, hunt_spot_id, farm_id, tactics,
assistant_max, cnt_max, cnt_cooldown)` PK `(release_id, area_id, hunt_spot_id)`;
  slice area **500** hunt_spot **15**.
- `craft_recipes(release_id, id, title, description, artikul_id, type,
profession_id, skill_value, max_skill_value, ingredients jsonb, duration,
create_artikul_id, create_artikul_num, create_quality, create_type_id,
create_title, create_level_min, table_id)` PK `(release_id, id)`; UNIQUE
  `(release_id, artikul_id)`; type 1; slice **61** book **1861** output **1714**.
- `bonuses(release_id, id, kind, skill_id, delta, need_value, artikul_id, title, chat_msg)`
  PK `(release_id, id)`; kind `'skill'`; FK на `skill_definitions` и
  `artifacts`. Slice: **601** AGRILKA_MOBOV.
- `use_scripts(release_id, bonus_id, fail_plaque, require jsonb, effects jsonb)`
  PK `(release_id, bonus_id)`; **нет** FK на `bonuses` (script **2827** без
  bonus row).
- `dungeons(release_id, artikul_id, title, start_area_id, parent_area_id,
level_min, duration_sec, img_url, has_clear)` PK `(release_id, artikul_id)`.
  Slice: `has_clear=0` artikul 1/11/12/14.
- `dungeon_areas` / `dungeon_spawns` / `dungeon_spawn_encounters` /
  `dungeon_spawn_routes` / `dungeon_spawn_zones` — spawn authors route **или**
  zone, не оба. Не jsonb.
- `battlegrounds(release_id, type, id, …)` PK `(release_id, type, id)`;
  `battleground_rooms` / `battleground_leader_groups`. Slice: playable
  Раскоп `general|2` и dump-карты без queue.

Отдельных spell-таблиц нет: fight spell живёт в `artifacts.extra`.
`common|conf`, empty chrome и HUD defaults читаются из
`catalog.game_wide_documents` активной release; level/appearance metadata — из
versioned catalog tables той же release. Исходные bootstrap-файлы являются
import input publication pipeline, а не runtime source gameplay-запроса.
Chat/menu links пока остаются в обязательной game policy.

Hero creation читает L1 из pinned progression
snapshot; policy хранит только EXP 1 и misc skills. Equipment totals
считаются из naked `hero_skills` и `artifacts.skills`; это derived
read/mutation state, не отдельная таблица.

### `world`

- `areas(release_id, id, title, parent_id, map_asset, fight_background, region_map,
ftime_max, code, context, sound_intro, sound_bg, inst_artikul_id,
have_trade_channel, have_kind_channel, hide_finished_fights,
hide_running_fights, no_clan_chat, bg_id)` PK `(release_id, id)`.
  `bg_id` — пустая строка = не комната BG; Раскоп rooms `"2"`.
  `parent_id` — пустая строка = нет родителя в slice. `map_asset` — SWF большой карты (`area_conf.swf`). Скалярные поля wire —
  колонки. `client_data` и `hunt_farm` mapper собирает пустыми. `area_conf.items`
  собираются из `world.area_links`.
- `area_links(release_id, from_area_id, item_id, to_area_id, title, picture,
description, flags, direction)` PK `(release_id, from_area_id, item_id)`;
  FK from/to `areas` той же release. Не JSONB.
- `hunt_spawns(release_id, id, area_id, bot_id, position_x, position_y, hunt_mask,
wait_min, wait_max, respawn_time_min, respawn_time_max, zone jsonb, route jsonb)`
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
  `content_type` ∈ `artifact|bot|area|area_link|hunt_spawn|store_type|store_lot|
reputation_track|profession|assistant_type|farm_resource|area_farm|bonus|use_script|skill|level|appearance|hud_defaults|chrome|
common_conf|welcome_message|dungeon|battleground`.
- `draft_versions(id, draft_id, version, schema_version, document jsonb, created_at)`.
- `releases(id, version UNIQUE nextval, checksum UNIQUE, schema_version, validator_version, created_at, activated_at)`.
- `release_entries(release_id, content_type, content_key, draft_version_id, digest)`.
- `active_release(lock_id=1, release_id, activated_at)` — singleton pointer.
- `bootstrap_imports(digest PK, release_id, source, applied_at)`.

Публикация — [CONTENT_PIPELINE.md](CONTENT_PIPELINE.md).

### `mail`

- `letters(id integer GENERATED ALWAYS AS IDENTITY START 1, owner_hero_id FK
heroes ON DELETE RESTRICT, folder inbox|outbox, peer_hero_id FK heroes NULL,
peer_nick, subject, body, sent_at timestamptz, expires_at timestamptz, flags,
money_come_minor, payment_minor, tax_minor, money_type 0|1, pair_id, system
0|1)`.

Unix `stime`/`rtime` только в jugger-wire. JSONB вложений нет (MAIL-02).

### `auction`

- `listings(id integer GENERATED ALWAYS AS IDENTITY START 1, kind lot|tender,
status open|sold|cancelled|expired, owner_hero_id FK heroes,
owner_kind, artikul_id, title, kind_id, quality, level_min, amount,
start_price_minor, buyout_minor, current_bid_minor, bidder_hero_id FK heroes
NULL, cancel_fee_minor, expires_at timestamptz, created_at timestamptz,
original_item_id (лот > 0; заказ 0), durability, durability_max, upgrade_*,
whole_stack_only, required_durability, required_durability_max, magic_id,
required_upgrade_id)`.

JSONB снимка dump нет. Unix `rtime` только в jugger-wire.

### `trade`

Таблиц нет. Сессия process-local (TRD-01); settle пишет только `heroes.money_minor`
и `inventory.items` через composition UoW (TRD-02).

### `chat`

Таблиц нет. Сообщения process-local через esrv outbox (SOC-01). Party type
идёт на `4:<partyId>` (SOC-02). Рестарт процесса теряет недоставленные кадры.

### `party`

- `parties(id integer GENERATED ALWAYS AS IDENTITY START 1, leader_hero_id FK
heroes ON DELETE RESTRICT, loot_rules 1|2|3, no_chat 0|1, flags, is_search 0|1,
password, instance_artikul_id, bot_artikul_id, type, distribute_ready_at,
created_at timestamptz)`.
- `party_members(PK party_id+hero_id, hero_id UNIQUE, account_id, joined_at)`.
- `party_invites(PK party_id+target_hero_id, from_hero_id, created_at)`.
- `party_bag_items(id integer GENERATED ALWAYS AS IDENTITY START 1, party_id FK
parties ON DELETE RESTRICT, artikul_id > 0, cnt >= 1, remove_time unix >= 0)`.
  `artikul_id` — catalog id, не `items.id`. TTL 3h, purge на access.

### `professions`

- `hero_assistants(id integer GENERATED ALWAYS AS IDENTITY START 1, hero_id FK
heroes RESTRICT, artikul_id, nick, skills, tactics, farm_id, area_id, ftime,
stime, attack_at, stamina, stamina_reset_time, mastery_value, result_*, flags,
cycle_result, loot_granted)`. FREE sentinels `farm_id=0`, `ftime=0`,
  `area_id="0"`.
- `hero_farm_stats(hero_id, farm_id, value)` PK; `value > 0`.
- `farm_stocks(area_id, hunt_spot_id, farm_id, cnt_current, last_respawn_time,
next_respawn_time)` PK `(area_id, hunt_spot_id)`. Publish `ON CONFLICT DO
NOTHING`.
- `hero_recipes(id integer GENERATED ALWAYS AS IDENTITY START 1, hero_id FK
heroes RESTRICT, recipe_id > 0, ftime >= 0, flags >= 0)` UNIQUE
  `(hero_id, recipe_id)`. Wire `artikul_id` = recipe id.

## План (не в runtime)

Таблицы ниже не созданы и не являются baseline. Их нельзя добавлять «на будущее»
без вертикального среза.

### `character`

Mana regen (`MPREG`/`mp_time` formula) и расширенная statistics
model остаются планом. `heroes.ghost` / `injury_time` / `injury_artikul_id`,
`heroes.regen_at`, `hp_time`, `experience_grants`, `hero_skills`,
`hero_reputations`, HP/MP/EXP и appearance bootstrap уже находятся в runtime.
BOOK-01 `hero_bot_kills` — runtime.
PRF-01 `hero_professions` — runtime.

### `inventory`

containers, item_modifiers, container_slots, equipment_slots, item_reservations.

### `catalog`

item_actions, item_stat_modifiers, creature_stats/loot, spell_definitions,
level_curves — отдельные таблицы поверх текущих `artifacts`/`bots`.
`level_skill_values` уже в runtime и не является будущей таблицей.
`store_types` / `store_lots` — runtime ECO-01/ECO-02 (`pay` / `requires`).
`reputation_tracks` — runtime REP-01 (только object_id 5).
`professions` — runtime PRF-01 (ids 2 and 6).
`assistant_types` / `farm_resources` / `area_farms` — runtime PRF-02.
`craft_recipes` — runtime PRF-03 (id 61).

### `world`

character_locations, presence_leases, spawn_leases, facts.

### `combat`

Durable sides/turns/effects, active participants и JSONB event log не
планируются. `arena|finished_fights` OA и `fight_info.php` в текущем срезе
не отдаются.

### `quests` / `social` / `economy` / `professions` / `instance`

`social` / `economy` модулей в runtime нет. Mailbox MAIL-02 живёт в `mail`
(`letters` + `letter_attachments`), не в `social` и без JSONB снимка dump.
Лоты и заказы AUC-01/AUC-02 живут в `auction.listings`, не в `economy`.
P2P обмен TRD-01/TRD-02 живёт в `trade` без таблиц, не в `economy`.
Чат SOC-01 живёт в `chat` без таблиц, не в `social`.
Party SOC-02/SOC-03 живёт в `party` (`parties` / `party_members` /
`party_invites` / `party_bag_items`), не в `social`.
DNG-01/DNG-02: `instance.copies` / `binds` / `killed_spawns` (строки, не dump
JSONB `killed_spawns_json`). `copies.copy_type` `dungeon|bg`.
`heroes.instance_copy_id` nullable без FK.
PRF-01: `catalog.professions` pair 2+6; `character.hero_professions`.
PRF-02: `catalog.assistant_types` / `farm_resources` / `area_farms`;
`professions.hero_assistants` / `hero_farm_stats` / `farm_stocks`.
PRF-03: `catalog.craft_recipes` (authored id, typed ingredients jsonb);
`professions.hero_recipes` (identity id from 1, UNIQUE hero+recipe).
Контракт: [PROFESSIONS.md](../modules/PROFESSIONS.md).
QST-ENG-01/02 / DAY-01: schema `quests` — authored NPC/quest/dialog/script
(`release_id`) и player `hero_quests` / `hero_quest_goals` / `hero_facts`;
waiting колонки и `hero_quests.hidden_in_journal` integer 0/1, без JSONB.
Loot-cap и AREA `progress_on_win` не добавляют
таблиц: cap считается из текущей loot/deliver цели; бой паркует bump, пока
onFinish несёт `START_FIGHT`. Контракт: [QUESTS.md](../modules/QUESTS.md).
Контракт: [INSTANCE.md](../modules/INSTANCE.md), книга —
[BOOK.md](../modules/BOOK.md).
BG-01: `battleground.finished_matches` / `finished_players` (typed, не jsonb);
queue/invite/ban/live score — RAM. Контракт:
[BATTLEGROUND.md](../modules/BATTLEGROUND.md).

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
   `hud_defaults`/`chrome`/`common_conf`/`welcome_message` конкретной release;
6. `catalog.craft_recipes.ingredients` — validated `{ artikulId, amount }[]`
   конкретной release; unknown shape fails publication.

Для каждого JSONB обязательны владелец, версия, validation до записи, лимит
размера и запрет частичных business-update через `jsonb_set`. Если ключ
участвует в ограничениях, join, сортировке или деньгах — это колонка.

## Read model для `init/init2`

`BootstrapReadModel` собирает typed snapshot через application ports, не через
общий SQL join всех модулей. `jugger-wire` переводит snapshot в плоские
`init/init2` и `state`. Отсутствие обязательного hero/content — ошибка. Готовый
AMF не хранится как источник истины. Отдельная persisted bootstrap projection
не вводится до измеренного узкого места.
