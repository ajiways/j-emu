# Persistence

## Стандарт

Постоянное состояние хранится в одном Postgres.

- Drizzle ORM — обязательный API доступа к данным.
- `drizzle-kit` — обязательный инструмент схемы и миграций.
- `postgres.js` — только драйвер под Drizzle, не параллельный query layer.
- Production-репозитории в памяти для постоянных данных запрещены.
- In-memory repository разрешён только как test fake.
- ID постоянных сущностей выдаёт Postgres; реестр типов и диапазонов —
  [`ID_POLICY.md`](ID_POLICY.md).

## Владение схемой

Каждый бизнес-модуль хранит свои Drizzle schema files рядом со своим
persistence adapter и владеет описанными там таблицами.

Модуль не выполняет `INSERT`, `UPDATE` или `DELETE` в таблицах другого модуля.
Изменение чужих данных вызывается через публичный application port владельца.

Один Postgres используется прагматично:

- между таблицами разных модулей разрешены FK;
- одна команда может использовать одну транзакцию для нескольких модулей;
- application service задаёт границу транзакции;
- вызванные модули присоединяются к переданному transaction context;
- repositories не делают самостоятельный commit.

FK и общая транзакция не дают права обходить application port и писать в
чужую таблицу напрямую.

## Миграции

Новая миграция создаётся `drizzle-kit` с понятным именем через `--name`.
Имя имеет форму `<module>_<verb>_<subject>` в `snake_case`, например
`--name=inventory_add_item_reservations`. Случайные fantasy-названия,
`initial`, `update` и номер без смысла запрещены. Исключение — текущий
pre-baseline init `foundation_init`: одна миграция на весь playable slice.

`drizzle-kit generate` обязан завершаться успешно. Если kit падает
(например `Do not know how to serialize a BigInt`), чинится schema file,
а не пишется SQL руками. JS `bigint` defaults запрещены: для SQL `0`
используется `sql\`0\``, не `0n`.

Одна миграция содержит одно когезионное изменение либо минимальный набор,
который нельзя применить раздельно из-за FK. До baseline инкрементальные
`0001`… не копятся: схема меняется в Drizzle files, затем цепочка
схлопывается в новую `0000_foundation_init` (`npm run db:generate -- --name=foundation_init`
после удаления `drizzle/*.sql` и каталога `drizzle/meta`). Пустой `meta/`
без `_journal.json` kit не принимает — удалять надо всю `meta/`, чтобы kit
создал сухой journal.

Текущая схема — `drizzle/0000_foundation_init.sql` (ADR-0018 identity и
sequences, `finished_fights`, content publication) плюс
`drizzle/0001_inventory_item_upgrade.sql` (INV-06 overlay колонки на
`inventory.items`, `NOT NULL` без SQL DEFAULT),
`drizzle/0002_inventory_item_tempeffect.sql` (INV-07 `location_kind=tempeffect`,
quantity 0, без unique слота) и
`drizzle/0003_inventory_item_expire_use.sql` (INV-08 `items.expire` NOT NULL
без SQL DEFAULT, `catalog.bonuses` / `catalog.use_scripts`,
`character.hero_learned_bonuses`) и
`drizzle/0004_content_draft_use_types.sql` (`content.drafts` CHECK добавляет
`bonus` / `use_script`). Snapshot и journal
перегенерированы из schema files. В `0000` после generate добавлен только
`INSERT` singleton-строки `content.active_release`: kit не умеет выразить
эту строку из Drizzle schema, а runtime требует ровно одну запись.
Других ручных правок SQL нет.

`drizzle-kit` читает module-owned schema files из `drizzle.config.ts`.
`pgSchema` экспортируется, чтобы kit создал PostgreSQL schema. Общего
runtime barrel `db/schema.ts` нет.

Пока не объявлен первый стабильный baseline, цепочку `drizzle/` схлопывают
в новую `0000`. Существующие БД и данные при схлопывании не сохраняются:
`npm run db:reset`.

После объявления стабильного baseline применённый SQL, snapshot и journal
entry неизменяемы: файл не редактируется и не переименовывается.
Исправление — новая миграция. Схлопывание запрещено.

Локальный ledger, который не совпадает с файлами (`was modified`, missing
journal), тоже не чинят руками. Development `DATABASE_URL` без суффикса
`_test` пересоздаётся `npm run db:reset` (DROP DATABASE, migrate, publish).
`TEST_DATABASE_URL` сбрасывают только test scripts.

Модуль меняет только свои Drizzle schema files. Межмодульный FK согласуется с
владельцем обеих сторон и создаётся миграцией владельца зависимой таблицы.

## Raw SQL

Raw SQL — исключение, а не второй способ persistence. Он допустим, только если:

1. нужную операцию нельзя корректно выразить через Drizzle либо есть измеренная
   проблема SQL/плана;
2. причина записана рядом с вызовом;
3. указаны затронутые таблицы и ожидаемый результат;
4. поведение покрыто интеграционным тестом;
5. запрос выполняется в переданном transaction context, если операция
   транзакционная.

Удобство или более короткая запись не являются причиной для raw SQL.

## Проверки

- Схема Drizzle является источником generated migrations.
- `npm run test:integration` поднимает пустой Postgres (`TEST_DATABASE_URL` с
  суффиксом `_test`) и применяет все миграции по порядку.
- Интеграционные тесты проверяют rollback Unit of Work, sequence IDs, atomic
  content publication и bounded cleanup `finished_fights`.
- `npm run check:architecture` запрещает `Memory*`, `import()`, `AmfValue` вне
  codec и Fastify/Drizzle/AMF в domain/application; Knip — unused files/exports.
- Production composition не может подключить test fake вместо Postgres
  repository.

Основное решение:
[ADR-0018](../adr/ADR-0018-postgres-content-and-identifiers.md).
