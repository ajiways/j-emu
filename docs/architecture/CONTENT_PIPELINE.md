# Пайплайн контента

## Цель

Весь игровой контент проходит один путь:

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

Все стадии находятся в одном PostgreSQL. Runtime обслуживает игровые запросы только из активных версий runtime-таблиц.

## Текущий playable slice

Реализованы типы `artifact`, `bot`, `area`, `hunt_spawn`. Seed:
`npm run db:publish:development` с `CONTENT_BUNDLE_FILE` и `DATABASE_URL`
из `.env` в корне пакета. Повтор с тем же checksum не создаёт новый release.
Остальные типы из карты import contracts ниже — план.

## Состояния и ответственность

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

Откат — такая же отдельная атомарная активация ранее опубликованной совместимой release. Строки старых release остаются immutable до управляемой retention-очистки.

## Порядок зависимостей

Граф импорта задаётся явно и является частью validator:

```text
Pub1 item artifacts ───→ items ───┬──→ loot
                                  ├──→ stores
                                  └──→ bonuses

Pub1 bestiary ─────────→ bots ────┬──→ loot
                                  └──→ dungeons

dialogs + NPC ─────────→ quests

areas
├── professions / resource nodes
├── world / spawns / links
└── stores

spell book + spell damage ─→ combat-ready spell definitions

bots + loot + areas ───────→ dungeons

reputation tracks
├── reputation rewards / gates
└── quests / kill grants
```

Практические правила:

- item artifacts и bestiary из `Pub1` импортируются независимо; item/bot
  definitions должны существовать до совместной проверки loot;
- item/creature/spell reference не может указывать на отсутствующий Pub1 artifact;
- dialogs и NPC валидируются до quests;
- areas валидируются до professions, world spawns/routes и stores;
- spell book и spell damage входят в release, а не загружаются runtime из fixtures;
- dungeons и reputation tracks входят в тот же candidate и проверяются со всеми внешними ссылками.

Цикл зависимостей является ошибкой модели candidate. Его нельзя обходить вторым проходом с временными пустыми ссылками.

## Карта import contracts

Каждый importer имеет одного владельца, отдельный decoder и validator:

- `catalog`: Pub1 artifact/artikul AMF и item overlays; decoder сохраняет wire
  ID без перенумерации, validator проверяет обязательные type/kind/picture,
  действия, цены и ссылки на assets.
- `catalog`: Pub1 bestiary, `bots_overlay.json`, hunt/event/quest bot sources;
  validator проверяет bot ID, stats, presentation и ссылки на spells/loot.
- `catalog`: loot/drop sources; validator запускается после items и bots и
  проверяет item references, количества, веса и условия.
- `quests`: `dialogs.json`, `strangers_quest_dialogs.json`,
  `npc_catalog.json`, `radvei_npcs.json`, затем `quests_curated/*.json`;
  validator проверяет graph, step/dialog/NPC/item/area references и rewards.
- `world`: `radvei_areas.json`, `hunt_spawns.json` и authored links/routes;
  validator проверяет уникальность area/point/spawn IDs, bot references и
  достижимость ссылок.
- `economy`: `stores/*.json`; validator проверяет area, item, stock/price и
  валюту без подстановки отсутствующего артикула.
- `catalog`: `bonuses.json`; validator проверяет artifact/action/effect
  references и не принимает неизвестный effect как generic JSON.
- `catalog`: `bot_spell_book.json`, `spell_catalog_overlay.json`,
  `spell_damage.json`; validator объединяет их в полное spell definition и
  отклоняет отсутствующую формулу или presentation.
- `professions`: Pub1/JSON definitions, recipes и resource nodes; validator
  проверяет areas, ingredients, results и требования.
- `instances`: `dungeons/*.json`; validator проверяет areas, encounters,
  bots, loot и checkpoint graph.
- `catalog`: `reputation_tracks.json` и `reputation_kills.json`; validator
  проверяет track levels, rewards/gates и ссылки quests/bots.

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

Для начального масштаба транзакции, блокировки, ограничения и audit-таблицы одного PostgreSQL дают необходимую атомарность без дополнительной распределённой инфраструктуры.
