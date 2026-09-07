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
`initial`, `update` и номер без смысла запрещены.

Одна миграция содержит одно когезионное изменение либо минимальный набор,
который нельзя применить раздельно из-за FK. Initial baseline делится по
зависимостям модулей:

1. `identity_create_accounts_and_sessions`;
2. `catalog_create_artifacts_and_bots`;
3. `world_create_areas_and_spawns`;
4. `character_create_heroes`;
5. `inventory_create_items`;
6. `combat_create_fights_and_participants`;
7. `issue_database_identifiers`;
8. `content_create_publication_and_versioned_projections`;
9. `combat_replace_state_with_finished_history`.

`drizzle-kit` читает module-owned schema files из `drizzle.config.ts`. Общего
runtime barrel `db/schema.ts` нет.

Baseline SQL живёт в `drizzle/` и применяется только Drizzle migrator. Применённый
файл не редактируется и не переименовывается. Любое исправление — новая миграция.

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

Основное решение: [ADR-0010](../adr/ADR-0010-drizzle-persistence.md).
