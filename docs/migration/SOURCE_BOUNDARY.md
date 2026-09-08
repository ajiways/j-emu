# Граница переноса из jgr-emu

## Нормативная граница

`jgr-emu` — рабочий поведенческий baseline для цикла персонажа 1–8.
Подтверждённые в старом клиенте сценарии переносятся целиком, но реализуются
заново через модули, typed DTO и PostgreSQL-модель `j-emu`.

`jgr-emu`, `_research`, live/CEF dumps и старые fixtures остаются read-only
корпусом. Новый runtime не зависит от них после импорта и публикации контента.

Запрещено:

- копировать старую структуру модулей, handlers, DB-модель или process state как
  архитектуру нового runtime;
- импортировать пакеты, handlers, seed-функции или DB-модели из `jgr-emu`;
- читать старые JSON, AMF, `.bin`, дампы или `_research` во время игрового запроса;
- исправлять старый корпус из нового редактора;
- сохранять fallback на fixture при отсутствии строки в PostgreSQL.

Разрешено и обязательно:

- читать старый код, документацию и fixtures для восстановления полного
  сценария, а не одного запроса;
- переносить подтверждённые wire shapes, порядок side effects, бизнес-правила и
  authored content;
- сохранять legacy behavior без повторного research, если оно работает в
  клиенте, не противоречит более сильному evidence и не помечено старым проектом
  как stub или известная ошибка;
- переосмысливать persistence, transactions, module boundaries и API ports под
  архитектуру `j-emu`.

Request-by-request reverse engineering не является штатным способом миграции.
Он применяется только при конфликте источников, неизвестном wire, клиентском
регрессе или явно отмеченной дыре старого runtime.

После импорта provenance сохраняется как metadata/digest, но runtime зависит
только от активной release в PostgreSQL.

## Старые входы `jgr-emu`

Ниже перечислены входные группы, которые должны получить явный importer и
schema. Первая волна ограничена данными, необходимыми для цикла 1–8.

- **Pub1 и каталоги:** AMF/бинарные клиентские artifacts, artikuls, изображения и стабильные клиентские идентификаторы.
- **Предметы и действия:** artifact definitions, `artifact_use.json`, веса/цены и отображаемые поля.
- **Bots/creatures:** bestiary, `bots_overlay.json`, hunt/event/quest bots и характеристики.
- **Loot:** drop references, quantities, weights, reputation/quest conditions.
- **Мир:** `radvei_areas.json`, `hunt_spawns.json`, permanent/event hunt, area links, farms и BG areas.
- **NPC и диалоги:** `npc_catalog.json`, `radvei_npcs.json`, `dialogs.json`, `strangers_quest_dialogs.json`.
- **Квесты:** `quests_curated/*.json`, inventory цепочки, AREA-цели, rewards и scripts.
- **Магазины и бонусы:** `stores/*.json`, `bonuses.json`.
- **Заклинания:** `bot_spell_book.json`, `spell_catalog_overlay.json`, `spell_damage.json`.
- **Репутация:** только tracks, gates и rewards, которые требуются квестам 1–8.
- **Исследовательские материалы:** `_research`, протокольные samples, dumps и извлечённые наблюдения используются для сверки, карантина неизвестных полей и provenance.

Персональные runtime-данные, bot-generated state, сессии, очереди, locks и результаты старых фоновых workers не являются authored-контентом и в этот импорт не входят.

Профессии, данжи, battlegrounds, достижения и полный social/economy переносятся
только отдельным решением после core 1–8. Clan и встроенные playerbots не
переносятся.

## Приоритет доказательств

Для обычного переноса подтверждённое клиентом поведение `jgr-emu` является
готовой спецификацией. При конфликте используется порядок:

1. воспроизводимый live dump;
2. фактический parser/поведение клиента;
3. поведение `jgr-emu`, воспроизведённое в клиенте;
4. binary fixture с известным происхождением;
5. согласованные независимые дампы;
6. authored fixture и тематическая документация `jgr-emu`;
7. гипотеза.

Формулы, помеченные в старом проекте как invented/empirical, можно перенести как
`legacy behavior`, но нельзя называть live parity. Stub `status:100` не
переносится: неподдержанная операция отвечает документированным `203`.

Конфликт не разрешается молча. Для контента importer записывает validation
error с обоими источниками и отклоняет весь candidate release.

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

areas ────┬──→ world spawns/routes
          └──→ stores required by quests

spell book ─┬──→ spell definitions
spell damage┘

reputation tracks ──→ reputation kills/gates/rewards ──→ quests
```

Граф дополняется конкретными foreign references в manifest. Общие правила:

- item artifacts и bestiary из Pub1 импортируются независимо; item/bot
  definitions существуют до проверки loot;
- dialogs и NPC существуют до quests;
- areas существуют до world и требуемых квестами stores;
- spell book, spell damage и требуемые reputation tracks публикуются как
  обычные versioned данные;
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

## Цикл переноса capability

1. Выбрать строку из legacy `CAPABILITIES.md` внутри текущего среза.
2. Собрать связанные old routes, domain rules, docs и content inputs.
3. Зафиксировать адаптированный контракт в модульном документе `j-emu`.
4. Реализовать сценарий заново через public ports и static command registry.
5. Импортировать authored data через drafts → release → publication.
6. Проверить raw-AMF E2E, persistence/reconnect и один сценарий в клиенте.
7. Обновить только `j-emu/docs/CAPABILITIES.md`.

Capability перенесена, когда runtime работает без доступа к старому corpus, а
удаление этого доступа не меняет поведение.
