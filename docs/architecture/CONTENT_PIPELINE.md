# Пайплайн контента

## Цель

Целевой путь всего игрового контента:

```text
import corpus / editor
        ↓
versioned drafts
        ↓ validate complete candidate
immutable release bundle
        ↓ materialize
versioned runtime tables
        ↓ atomic activate
active release
```

Все стадии целевой модели находятся в одном PostgreSQL. Runtime обслуживает
игровые запросы только из активных версий runtime-таблиц. Реализованная часть
этого пути перечислена отдельно ниже; схема не означает, что editor,
independent candidates или validation reports уже существуют.

Канонический инвентарь source groups, этапы `DATA-01`…`DATA-06`, ownership,
counts/checksums и completeness gates:
[CONTENT_MATRIX.md](../migration/CONTENT_MATRIX.md). Этот документ задаёт
механику публикации, но сам по себе не утверждает полноту импортированных
данных.

## Текущий playable slice

Текущая `playable-slice/v33` release — минимальный bundle: 37 artifacts
(9095 + dump-proven L1 greyset **20/21/26**, glove spells **9098/9100/9099**, paperdoll gear-spell **20546**, pocketables **93** и **99**, food **77**,
shop wear **23** и **24**, arsenal amulet **621**, upgrade crystals **553/1310/4603/11408/13224**, recruit set **27/28/30/33/35/106** и mix **43/46**,
USE **640/623/2371/55/584**, farm **1720/1721/1722**, craft book **1861** / flask **1714**; без 209 и патронташа), 8 bots (2/4/24/32/99/353/354/373) с overlay reward scalars; loot entries только у bot 2 (77/93/99),
bonus **601**, use script **2827**, assistant types **3/13**, farm resource **4** on area **500**, craft recipe **61**,
12 areas (503/501/504/495/552/542/541/654/651/653/499/673) plus BG return 500 and rooms 635/636/637, authored travel `area_links` including dungeon doors 501↔542, 541↔654, 651↔653, 499↔673 and Раскоп 635↔636↔637, hunt 50310 (home), 50309 (route+respawn) и 50101–50103 (zone), dungeons 1/11/12/14 (bots 99/354/353/373), battlegrounds Раскоп `general|2` plus dump cards, store 504 type `-131` lots 80/23 и 82/24, store 552 type 11 lot 438/621 RANK, reputation track **5**, 17 skills (включая **MAGSTR**, **LUCK**, **INJ_RESIST**), 14 levels с normalized managed skills,
3 appearance presets (kind 1/2/3 gender 1), NPC **271** (503 item **4**) и
**272** (item **8**), AREA ambush 503 item **1**, with seven engine quests
(`q_engine_board` / `q_engine_fight` / `q_engine_area` / `q_engine_daily` /
`q_engine_roster` / `q_engine_multi` / `q_engine_ambush`)
and world fact `engine_area`, и common-conf/chrome/HUD/welcome документы в составе текущего
bundle. Bots 2/4/24/32 несут `spellBook` (Грызль пустая; Хисса 396, дух 422,
рыжий 394); огр 99 и боссы 353/354/373 — пустая книга. Это нельзя называть полным игровым контентом или полным контентом
цикла 1–8.

Seed: `npm run db:publish:development` с `CONTENT_BUNDLE_FILE` и `DATABASE_URL`
из `.env` в корне пакета. Повтор с тем же checksum не создаёт новый release.
Новый checksum на уже опубликованной БД создаёт и активирует следующую release
через `publish` (тот же npm-скрипт).
Остальные типы и расширение текущих минимальных каталогов из матрицы — план.

## `playable-slice.json` — временный bootstrap, не целевой механизм

`content/playable-slice.json` — это вручную собранный bundle для самого
раннего этапа (Wave 0–3), пока не было ни одного типизированного decoder.
Он **не является** целевым способом заводить контент и не должен расти рукой
до полного каталога — руками добавленный файл на весь Pub1-каталог (~22 560
артикулов, весь бестиарий, все области) физически станет неподъёмным
(порядка миллионов строк) и не даст ни manifest, ни per-source checksum, ни
дедупликации, которые требует `CONTENT_MATRIX.md`.

Правило: как только для домена (`catalog` items, `catalog` bots/spells,
`world` areas/hunt, `economy` stores, …) появляется хотя бы одна capability,
которая с ним работает, **приоритет — построить типизированный decoder этого
домена** (см. `CONTENT_MATRIX.md`, DATA-02…06 и POST-01…06), а не добавлять
ещё одну ручную запись в `playable-slice.json`. Ручной bundle используется
только для типов, для которых ещё нет ни одной работающей capability.

`jgr-emu` уже содержит полный набор seed-скриптов — по одному на домен, не
только для items. Каждый — evidence/reference для алгоритма соответствующей
DATA-стадии (не runtime-зависимость и не копирование файла,
`SOURCE_BOUNDARY.md`). Делятся на два разных по цене класса:

**Уже разбирают сырой Pub1 AMF/bin — готовый алгоритм формата, дешевле, чем
писать AMF3-парсер заново:**

- `jgr-emu/src/db/seed_artifacts.ts` — все
  `Pub1/.../amf/artifact_artikul_*.amf` (~22 560 файлов) → DATA-02 items.
- `jgr-emu/src/db/seed_bots.ts` — `Pub1/.../amf/bestiary.amf` → DATA-03 base
  bots/loot; JSON-fallback только для ID, которых нет в AMF (данж-only боты),
  `bots_overlay.json` — пример authored-слоя поверх base (см.
  `SOURCE_BOUNDARY.md` § «Собственные правки поверх базовых данных»).
- `jgr-emu/src/db/seed_game_config.ts` — `common_conf.bin`/`common_init2.bin`
  (реальный AMF live-дампа) → DATA-01 bootstrap-конфиги; тот же файл также
  льёт `radvei_areas.json`/`radvei_hunt_bots.json`/`hunt_spawns.json`
  (уже authored JSON, не сырой AMF) → DATA-04 areas/hunt.
- `jgr-emu/src/db/seed_professions.ts` — `assistant_list.amf`,
  `farm_list.amf`, `farm_types.amf`, `recipes.amf` → POST-02 professions.

**Читают уже authored/curated JSON (не сырой клиентский формат) — тоже
полезный evidence состава и связей, но decoder тут почти не нужен, нужен
только validator под схему:**

- `seed_bot_spell_book.ts` (`bot_spell_book.json`) → DATA-03 spell definitions;
- `seed_store.ts` (`fixtures/stores/*.json`) → DATA-05 stores;
- `seed_reputation.ts` (`reputation_tracks.json`, `reputation_kills.json`) →
  DATA-05 reputation;
- `seed_bonuses.ts` (`bonuses.json`) → DATA-05 bonuses/consumable USE;
- `seed_artifact_use.ts` (`artifact_use.json`) → DATA-05/06 item scripts;
- `seed_quests.ts` (`quests_curated/*.json`, `npc_catalog.json`,
  `radvei_npcs.json`, `strangers_quest_dialogs.json`) → DATA-06 quests/NPC —
  это evidence самого низкого приоритета (content-fill, не движок);
- `seed_dialogs.ts` (`dialogs.json`) → DATA-06 standalone dialogs;
- `seed_world.ts` (`world_facts.json`) → DATA-06 world facts/rules.

Копировать сам файл/модуль запрещено, но пересобрать тот же разбор формата
или ту же схему под typed drafts с manifest/checksum/validator — ожидаемый
путь для каждой DATA-стадии в `CONTENT_MATRIX.md`.

## Что реализовано сейчас

`ContentPublicationService.publish/seed`:

1. синхронно валидирует один typed bundle в памяти;
2. в одной Unit of Work блокирует singleton `active_release`;
3. записывает release, drafts/draft_versions и release entries;
4. материализует текущие catalog/world projections;
5. переключает active release pointer.

`seed` идемпотентен для matching bootstrap checksum: не создаёт новый
release и возвращает pointer на bootstrap, если editor его сдвинул.
Запрещает bootstrap поверх другой существующей release. Обычный `publish`
отклоняет уже существующий checksum.

File `seed`/`publish` по-прежнему принимает in-memory bundle. EDT-01 landed:
`saveDraft` / persisted candidate / validation report / publication audit
через HTTP `/operator/content/*`, без записи файлов
([CONTENT.md](../modules/CONTENT.md)). Manifest export/import и rollback
остаются планом. EDT-02 landed: operator GET document/keys из active
release, не из authored файла.

## Целевой publication contract — план

### Черновики

Редактор создаёт новую `draft_version`, а не меняет существующую. Версия хранит тип контента, стабильный ключ, schema version, документ, автора и время создания. Черновики могут быть неполными и никогда не доступны runtime.

Импорт старого corpus использует тот же входной порт, что и редактор, но помечает происхождение: путь источника, digest и тип доказательства. Это provenance, а не runtime-зависимость.

### Candidate и валидация

Команда сборки фиксирует полный набор конкретных `draft_version`. После этого состав candidate не меняется.

Валидация выполняется в порядке зависимостей и проверяет:

- schema и поддерживаемую версию каждого документа;
- уникальность стабильных идентификаторов;
- диапазоны и обязательные поля;
- все межтиповые ссылки;
- отсутствие ссылок на запись вне candidate;
- возможность полностью материализовать runtime-строки;
- детерминированность manifest и checksum.

Одна ошибка делает невалидным весь candidate. Ошибочные записи не пропускаются, валидная часть отдельно не публикуется.

Успешная валидация создаёт immutable release bundle:

- монотонную logical version;
- canonical manifest с типом, ключом, draft version и digest каждой записи;
- версии authoring и runtime schemas;
- checksum canonical manifest и содержимого;
- validation report и версию validator.

После создания bundle его manifest и состав не обновляются.

### Материализация

Материализатор читает только bundle и добавляет строки с его `release_id` в версионированные runtime-таблицы владельцев: catalog, world, quests, professions, instances и другие content-owned projections. Он не обновляет строки прежних release.

Материализация повторяема: одинаковые manifest, schema versions и данные дают тот же checksum и тот же логический результат. Конфликт с уже записанными отличающимися строками является ошибкой.

### Активация

Активация выполняется одной транзакцией PostgreSQL:

1. блокирует указатель активной release;
2. убеждается, что bundle полностью валиден и материализован;
3. повторно сверяет manifest/checksum и обязательные counts;
4. переключает active release pointer;
5. фиксирует publication audit record.

До commit весь runtime видит предыдущую release; после commit — новую. Смешивание версий в одном запросе запрещено. Длительная игровая операция сохраняет свой `release_id`, если изменение контента способно повлиять на её результат.

После DATA-01 `progressionDigest` является activation compatibility gate:
обычная новая release обязана сохранить тот же digest. Изменённая curve
отклоняется до переключения pointer и требует отдельной player-state migration
capability. Unrelated content может менять общий release checksum, не меняя
progression digest. Runtime publication уже применяет этот gate вместе с
additive artifact-skill compatibility.

Для equipment-derived character maxima действует additive compatibility:
artifact ID из предыдущей active release обязан сохраниться с теми же
stat-affecting skills; новый ID допустим. Удаление или изменение существующей
skill semantics отклоняет activation до отдельной player-state
migration/recalculation capability. Проверка сравнивает immutable active и
candidate projections и не читает player inventory.

Откат — такая же отдельная атомарная активация ранее опубликованной совместимой release. Строки старых release остаются immutable до управляемой retention-очистки.

## Порядок зависимостей

Единственный канонический граф source groups и стадий DATA/POST находится в
[CONTENT_MATRIX.md](../migration/CONTENT_MATRIX.md). Этот документ фиксирует
только механический инвариант: validator строит dependency DAG из manifest;
цикл является ошибкой candidate и не обходится временной nullable reference,
вторым проходом или lookup в предыдущей release.

Чтобы не создавать циклы, base entity и зависимая policy являются разными
typed documents. Например, base bot не зависит от spell; bot spell policy
валидируется после base bots и spell definitions. Quest ссылается на
reputation track, но authored track не ссылается обратно на quest.

## Карта import contracts

Эта карта задаёт правила contracts. Состав, стадия и текущий статус каждой
source group ведутся только в
[CONTENT_MATRIX.md](../migration/CONTENT_MATRIX.md).

Каждый importer имеет одного владельца, отдельный decoder и validator:

- `catalog`: DATA-01 level boundaries и per-level managed naked skills;
  validator проверяет одну непрерывную curve, одинаковый полный skill set,
  evidence kind и source digest. Runtime formula, clamping и смешивание release
  запрещены.
- `catalog`: Pub1 artifact/artikul AMF и item overlays; decoder сохраняет wire
  ID без перенумерации, validator проверяет обязательные type/kind/picture,
  skills, цены и ссылки на assets. Bonus/action policies — отдельные dependent
  documents DATA-05 и не являются обратной ссылкой base artifact.
- `catalog`: Pub1 bestiary, `bots_overlay.json`, hunt/event/quest bot sources;
  base validator проверяет bot ID, stats и presentation. Spell/loot policies
  валидируются отдельными documents после base bots и соответствующих
  definitions.
- `catalog`: base loot/drop sources; validator запускается после items и bots
  и проверяет item references, количества и веса. Quest/reputation conditions
  являются отдельными dependent policies DATA-05/06.
- `quests`: `dialogs.json`, `strangers_quest_dialogs.json`,
  `npc_catalog.json`, `radvei_npcs.json`, затем `quests_curated/*.json`;
  base NPC не ссылается на dialog/quest; validator проверяет dialogs и quests
  после base NPC, а board/map bindings — последними.
- `world`: `radvei_areas.json`, `hunt_spawns.json` и authored links/routes;
  validator проверяет уникальность area/point/spawn IDs, bot references и
  достижимость ссылок.
- `catalog`: ECO-02 subset `fixtures/stores/504.json` (type `-131` + lots 23/24) и
  `552.json` (type 11 + RANK lot 438/621) плюс Pub1/common_init artifacts 23/24/621;
  validator проверяет area 504/552, artifact refs, gold pay=price, RANK lot и
  «type без lots». Полный корпус `stores/*.json` —
  DATA-05 / модуль economy, не этот срез.
- `economy`: remaining `stores/*.json` (DATA-05); validator проверяет area,
  item, stock/price и валюту без подстановки отсутствующего артикула.
- `catalog`: `bonuses.json`; validator проверяет artifact/action/effect
  references и не принимает неизвестный effect как generic JSON.
- `catalog`: `bot_spell_book.json`, `spell_catalog_overlay.json`,
  `spell_damage.json`; validator объединяет их в полное spell definition и
  отклоняет отсутствующую формулу или presentation.
- `professions`: Pub1/JSON definitions, recipes и resource nodes; validator
  проверяет areas, ingredients, results и требования.
- `instances`: `dungeons/*.json`; validator проверяет areas, encounters,
  bots, loot и checkpoint graph.
- `catalog`: REP-01 subset `reputation_tracks.json` track **5** only; SUM 36
  и kill overlay не публиковать. Полный корпус треков/`reputation_kills` —
  DATA-05.
- `catalog`: PRF-01 pair `profession_info` ids **2** and **6**; publication
  replaces `common_conf.profession_info`. Full Pub1 professions — POST-02.
- `catalog`: `reputation_tracks.json` и `reputation_kills.json` (остаток DATA-05);
  validator проверяет track levels, thresholds/rewards и bot refs. Quest reward/gate refs
  проверяет quest validator, поэтому authored reputation не зависит обратно от
  quests.

Имя файла не определяет порядок. Manifest объявляет типы и references, а
validator строит и проверяет dependency graph. Decoder не импортирует старые
handlers/seed-функции и не читает другой источник для «дозаполнения» записи.

## Seed

`npm run db:publish:development` вызывает `ContentPublicationService.seed`:

1. вычисляет checksum authored bundle;
2. при уже записанном bootstrap digest с тем же checksum возвращает существующую
   release без изменений;
3. если в БД уже есть другая release без matching bootstrap import — ошибка;
4. иначе создаёт drafts, валидирует, материализует catalog/world и активирует
   начальную release.

Изменившийся corpus имеет новый digest и не маскируется повторным seed.

## Экспорт и восстановление

План, в текущем срезе команд нет. Целевое поведение:

Export release формирует переносимый пакет с manifest, checksum, schema versions и полным содержимым логического bundle. Runtime-таблицы не экспортируются как произвольный snapshot: они должны проверяться или воспроизводиться из bundle.

Import release:

1. проверяет формат, версии и checksum до изменения БД;
2. записывает immutable bundle идемпотентно по checksum;
3. материализует и полностью валидирует runtime rows;
4. оставляет release неактивной;
5. требует отдельной команды activation.

Импорт поверх bundle с тем же checksum и другим содержимым завершается ошибкой. Recovery не читает напрямую старые fixtures и не запускает старый runtime.

## Что сознательно отсутствует

- dual-write между файлами и PostgreSQL;
- чтение fixtures или draft JSON в gameplay runtime;
- SQLite-копия для редактора;
- object storage для bundle;
- broker для координации стадий;
- отдельный content service.

Для текущего масштаба одна PostgreSQL transaction, блокировка active pointer и
ограничения существующих release/draft tables дают необходимую атомарность без
распределённой инфраструктуры. EDT-01 добавляет publication audit на activate
candidate; export/rollback — не этот срез.
