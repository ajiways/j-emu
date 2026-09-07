# Граница источников миграции контента

## Нормативная граница

`jgr-emu`, `_research`, live/CEF dumps и старые fixtures — read-only корпус доказательств и вход для контролируемого импорта. Они помогают восстановить данные и подтвердить wire-семантику, но не являются компонентами нового runtime.

Запрещено:

- портировать старый runtime-код как реализацию нового домена;
- импортировать пакеты, handlers, seed-функции или DB-модели из `jgr-emu`;
- читать старые JSON, AMF, `.bin`, дампы или `_research` во время игрового запроса;
- считать старый runtime более сильным доказательством, чем воспроизводимый live dump или клиентский parser;
- исправлять старый корпус из нового редактора;
- сохранять fallback на fixture при отсутствии строки в PostgreSQL.

После импорта происхождение сохраняется как metadata/digest, но runtime зависит только от активной release в PostgreSQL.

## Старые входы `jgr-emu`

Ниже перечислены входные группы, которые должны получить явный importer и schema. Перечень задаёт границу миграции, а не разрешение копировать старую реализацию.

- **Pub1 и каталоги:** AMF/бинарные клиентские artifacts, artikuls, изображения и стабильные клиентские идентификаторы.
- **Предметы и действия:** artifact definitions, `artifact_use.json`, веса/цены и отображаемые поля.
- **Bots/creatures:** bestiary, `bots_overlay.json`, hunt/event/quest bots и характеристики.
- **Loot:** drop references, quantities, weights, reputation/quest conditions.
- **Мир:** `radvei_areas.json`, `hunt_spawns.json`, permanent/event hunt, area links, farms и BG areas.
- **NPC и диалоги:** `npc_catalog.json`, `radvei_npcs.json`, `dialogs.json`, `strangers_quest_dialogs.json`.
- **Квесты:** `quests_curated/*.json`, inventory цепочки, AREA-цели, rewards и scripts.
- **Магазины и бонусы:** `stores/*.json`, `bonuses.json`.
- **Заклинания:** `bot_spell_book.json`, `spell_catalog_overlay.json`, `spell_damage.json`.
- **Профессии:** определения профессий, рецепты, resource nodes, результаты и требования.
- **Данжи:** `dungeons/*.json`, templates, encounters и ссылки на areas/bots/loot.
- **Репутация:** `reputation_tracks.json`, `reputation_kills.json`, gates и rewards.
- **Исследовательские материалы:** `_research`, протокольные samples, dumps и извлечённые наблюдения используются для сверки, карантина неизвестных полей и provenance.

Персональные runtime-данные, bot-generated state, сессии, очереди, locks и результаты старых фоновых workers не являются authored-контентом и в этот импорт не входят.

## Приоритет доказательств

При конфликте источников используется порядок:

1. воспроизводимый live dump;
2. фактический parser/поведение клиента;
3. binary fixture с известным происхождением;
4. согласованные независимые дампы;
5. authored fixture старого `jgr-emu`;
6. поведение старого runtime;
7. документация;
8. гипотеза.

Конфликт не разрешается молча. Importer записывает validation error с обоими
источниками и отклоняет весь candidate release. Отдельная «карантинная» запись
не считается успешно импортированным draft.

## Граф переноса

Каждая стрелка означает: левая группа полностью импортирована и провалидирована до проверки правой.

```text
Pub1 item artifacts ──→ items ─────────→ loot
                          ├─────────────→ stores
                          └─────────────→ bonuses

Pub1 bestiary ────────→ bots ──────────→ loot

dialogs ──┐
          ├──→ quests
NPC ──────┘

areas ────┬──→ professions
          ├──→ world spawns/routes
          └──→ stores

spell book ─┬──→ spell definitions
spell damage┘

areas + bots + loot ──→ dungeons

reputation tracks ──→ reputation kills/gates/rewards ──→ quests
```

Граф дополняется конкретными foreign references в manifest. Общие правила:

- item artifacts и bestiary из Pub1 импортируются независимо; item/bot
  definitions существуют до проверки loot;
- dialogs и NPC существуют до quests;
- areas существуют до professions, world и stores;
- spell book, spell damage, dungeons и reputation tracks публикуются как обычные versioned данные;
- ни один runtime-модуль не дочитывает отсутствующий тип из fixtures.

## Правила одного importer

Importer конкретного типа:

1. принимает immutable source document и provenance;
2. разбирает его без обращения к старому runtime;
3. выдаёт нормализованный draft либо диагностируемую ошибку;
4. не подставляет default для обязательного поля;
5. не создаёт отсутствующую referenced entity;
6. не пропускает неизвестную строку;
7. не активирует release.

Если одна строка файла невалидна, не импортируется весь candidate source set. Допустим отдельный исправленный draft с новой версией; недопустим «успешный импорт 99 из 100».

## Этапы вывода старых источников

1. Зафиксировать corpus, provenance и digest без изменения оригиналов.
2. Создать import profile с точным перечнем файлов и ожидаемых типов.
3. Импортировать versioned drafts в пустой PostgreSQL.
4. Провести полную schema/reference validation по графу.
5. Создать immutable bundle, материализовать runtime-таблицы и атомарно активировать release.
6. Проверить клиентские contract-сценарии против новой release.
7. Запретить filesystem access к старому corpus в runtime deployment.
8. Сохранить исходный corpus только как архив доказательств и средство повторяемого bootstrap/research.

Завершение миграции типа означает, что его активные runtime-таблицы полностью строятся из release bundle, а удаление доступа к `jgr-emu`, `_research`, dumps и fixtures не меняет поведение запущенного сервера.
