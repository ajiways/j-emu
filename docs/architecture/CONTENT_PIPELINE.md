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

Текущая `playable-slice/v14` release — минимальный bundle: 9 artifacts
(9095 + dump-proven glove spells **9098/9100/9099**, pocketables **93** и **99**, food **77**,
shop wear **23** и **24**; без 209 и патронташа), 1 bot с overlay reward scalars и `bot_loot_entries` 77/93/99,
3 areas (503/501/504), authored travel `area_links`, 1 hunt spawn на 503, store 504 type `-131` и lots 80/23 и 82/24, reputation track **5**, 11 skills, 8 levels с normalized managed skills,
1 appearance и common-conf/chrome/HUD/welcome документы в составе текущего
bundle. Это нельзя называть полным игровым контентом или полным контентом
цикла 1–8.

Seed: `npm run db:publish:development` с `CONTENT_BUNDLE_FILE` и `DATABASE_URL`
из `.env` в корне пакета. Повтор с тем же checksum не создаёт новый release.
Новый checksum на уже опубликованной БД создаёт и активирует следующую release
через `publish` (тот же npm-скрипт).
Остальные типы и расширение текущих минимальных каталогов из матрицы — план.

## Что реализовано сейчас

`ContentPublicationService.publish/seed`:

1. синхронно валидирует один typed bundle в памяти;
2. в одной Unit of Work блокирует singleton `active_release`;
3. записывает release, drafts/draft_versions и release entries;
4. материализует текущие catalog/world projections;
5. переключает active release pointer.

`seed` идемпотентен только для matching bootstrap checksum и запрещает
bootstrap поверх другой существующей release. Обычный `publish` отклоняет уже
существующий checksum.

Отдельных editor-команд `saveDraft`, persisted candidate, validation report,
publication audit record, manifest import/export и rollback command сейчас нет.
Они относятся к целевому контракту ниже и реализуются только соответствующими
DATA/EDT capabilities.

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
- `catalog`: ECO-01 subset `fixtures/stores/504.json` (type `-131` + lots 23/24) и
  Pub1 artifacts 23/24; validator проверяет area 504, artifact refs, price и
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
распределённой инфраструктуры. Publication audit record появится только вместе
с целевым publication contract.
