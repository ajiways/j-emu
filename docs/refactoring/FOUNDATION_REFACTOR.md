# Foundation refactor

## Цель и границы

План переводит текущий vertical slice на устойчивый фундамент без добавления
gameplay. На всём протяжении сохраняются существующие подтверждённые OA, fproxy,
esrv, auth/cookie flow и wire shapes. Новый квест, предмет, бой, команда или
клиентское окно не входят в refactor.

Порядок фаз обязателен: следующая начинается только после acceptance gate
предыдущей. Каждая фаза — отдельный reviewable PR. Документы и ADR уже задают
целевые ограничения; реализация не меняет их задним числом ради текущего кода.

## Базовая линия и текущие нарушения

Состояние на 2026-09-07:

- `package.json` использует `postgres`, Drizzle ещё не подключён;
- `src/infrastructure/postgres/database.ts` предоставляет raw SQL connection и
  самодельный AsyncLocalStorage Unit of Work;
- `src/infrastructure/postgres/migration-runner.ts` и `migrations/0001_initial.sql`
  образуют самодельный migration toolchain;
- `src/infrastructure/postgres/import-development-content.ts` напрямую делает
  upsert runtime catalog/world из game policy;
- `src/modules/*/infrastructure/postgres-*.ts` используют raw SQL и смешивают
  несколько implementations в отдельных файлах;
- `src/app/composition-root.ts` выбирает memory/postgres, создаёт весь object
  graph и содержит два exported classes;
- production memory implementations находятся в
  `src/modules/identity/infrastructure/memory-identity-repository.ts`,
  `src/modules/character/infrastructure/memory-hero-repository.ts`,
  `src/modules/catalog/domain/catalog.ts`,
  `src/modules/inventory/domain/inventory.ts`,
  `src/modules/world/domain/world.ts`,
  `src/modules/combat/application/combat-service.ts` и
  `src/shared/kernel/unit-of-work.ts`;
- `src/modules/jugger-wire/application/object-action-router.ts` использует общие
  `Record<string, AmfValue>`, строковый if-dispatch и содержит gameplay handler;
- `src/modules/jugger-wire/infrastructure/http/jugger-http-adapter.ts` объединяет
  auth, OA, esrv, fproxy, AMF parsing, TLS/static и превышает review threshold;
- `tests/support/harness/application-harness.ts` запускает production memory
  graph, поэтому `tests/e2e/playable-slice.test.ts` не является PostgreSQL E2E;
- несколько production-файлов экспортируют несколько основных типов:
  `catalog/domain/catalog.ts`, `inventory/domain/inventory.ts`,
  `world/domain/world.ts`, `combat/domain/battle.ts`,
  `combat/application/combat-service.ts`, `identity/domain/identity.ts`,
  `identity/infrastructure/postgres-identity-repository.ts`,
  `inventory/infrastructure/postgres-inventory-repository.ts`,
  `shared/kernel/events.ts`, `shared/kernel/clock.ts`.

Перед первым PR зафиксировать baseline: build/lint/test output, текущий список
routes/command keys и raw AMF fixtures существующего playable slice. Baseline не
легализует memory E2E, а только защищает wire от случайного изменения.

Первым изменением тестового harness в фазе 1 становится PostgreSQL E2E. Ни одна
последующая фаза не принимается только unit/integration тестами: её клиентский
сценарий сначала фиксируется raw-AMF E2E.

## Фаза 1. Drizzle и миграции

Статус: выполнена. Единственный migration path — generated SQL в `drizzle/`.
Playable-slice E2E идёт через Fastify и PostgreSQL.

### Работы

1. Подключить `drizzle-orm` и принятый PostgreSQL driver; добавить
   `drizzle-kit` только как development tool.
2. Создать module-owned Drizzle schemas для уже используемых таблиц identity,
   character, inventory, catalog, world и combat. Не добавлять таблицы будущего
   gameplay.
3. Определить единственный `Database` adapter и transaction runner поверх
   Drizzle; application получает Unit of Work/ports, а не ORM instance.
4. Сгенерировать несколько когезионных baseline migrations с именами
   `<module>_<verb>_<subject>`, эквивалентных фактически используемой части
   `0001_initial.sql`. Не переносить неиспользуемые схемы «на будущее».
5. Добавить forward-only migration command и журнал Drizzle. Применённые
   migrations неизменяемы.
6. Переписать существующие Postgres repositories на typed queries. Сначала
   сохранить signatures и wire behavior, затем разделять файлы в фазе 6.
7. Добавить integration tests clean migration, repeated migrate, rollback и
   upgrade с предыдущего baseline fixture.
8. Сразу перевести `ApplicationHarness` и playable-slice E2E на обязательный
   `TEST_DATABASE_URL`, production module factories и Drizzle. Memory E2E после
   этого удаляется.

### Acceptance gate

- clean test database разворачивается только Drizzle migrations;
- повторный migrate — no-op, изменение применённой migration обнаруживается;
- repositories не вызывают `sql.unsafe` и не импортируют raw `postgres`;
- transaction test доказывает rollback всех записей текущего сценария;
- baseline raw-AMF E2E проходит через Fastify и PostgreSQL;
- build/lint, E2E и релевантные unit/integration зелёные;
- custom migration runner и `migrations/0001_initial.sql` удалены после
  подтверждённой эквивалентности Drizzle baseline; второго migration path нет.

## Фаза 2. ID из базы данных

Статус: выполнена. Item/fight/participant ID выдают PostgreSQL sequences;
account/hero UUID — `gen_random_uuid()`; runtime не зависит от `memoryIds`.

### Работы

1. Зафиксировать тип каждого ID: UUID, text wire ID либо PostgreSQL bigint.
2. Перенести item/fight/participant ID allocation в PostgreSQL
   sequence/identity через Drizzle adapters.
3. На TypeScript boundary представлять потенциальный bigint без потери точности:
   `bigint` или validated decimal string; преобразование в wire number допустимо
   только при доказанном безопасном диапазоне конкретного поля.
4. Удалить зависимость runtime от `memoryIds` policy.
5. Проверить uniqueness при параллельных transactions и rollback gaps; gaps
   sequence являются нормой и не должны переиспользоваться.

### Acceptance gate

- production path не создаёт item/fight/participant IDs в памяти;
- параллельный integration test не получает duplicate IDs;
- item IDs сохраняют fight-safe нижнюю границу;
- reconnect/restart не меняет и не переиспользует выданный ID;
- raw AMF fixtures не получают непредусмотренное изменение numeric/string shape.

## Фаза 3. Контент и публикация

Статус: выполнена. Catalog/world runtime читает только активную PostgreSQL
revision; authored bundle — `content/playable-slice.json`, не game policy.

### Работы

1. Отделить runtime config (порты, TLS, timeouts) от authored game content.
2. Описать typed content draft/bundle/revision для уже существующих artifacts,
   bots, areas и hunt spawns — без нового контента.
3. Реализовать staging validation: обязательные поля, уникальные IDs, ссылки
   spawn → bot, wire assets и совместимость schema version.
4. Публиковать immutable revision атомарно. Catalog/world runtime reads видят
   только одну полностью опубликованную revision.
5. Заменить прямой upsert из `import-development-content.ts` на штатный import →
   validate → publish flow.
6. Удалить content arrays и `memoryIds` из game policy после миграции config.

### Acceptance gate

- invalid bundle не меняет активную revision;
- concurrent publication имеет одного победителя/явный conflict;
- restart читает ту же published revision из PostgreSQL;
- runtime не читает content из JSON policy и не выполняет dual-write;
- integration tests покрывают successful/failed publication и rollback;
- E2E playable slice использует опубликованный test bundle.

## Фаза 4. Удаление production memory

Статус: требует closeout. Process-local active combat соответствует ADR-0015,
но текущие migrations ещё создают superseded `combat.fights`,
`combat.participants`, `combat.events` вместо одной finished-history model с
TTL 72 часа.

### Работы

1. Удалить storage-driver branching из production config/composition.
2. Удалить production `MemoryIdentityRepository`,
   `MemoryHeroRepository`, `MemoryCatalog`, `MemoryInventoryRepository`,
   `MemoryItemIdSource`, `MemoryWorldRepository`, `MonotonicFightIdSource` и
   `PassthroughUnitOfWork`.
3. Нужные test doubles заново реализовать под `tests/support/fakes`; production
   их не импортирует.
4. Для `LongPollCoordinator`, connection-local buffers и active
   `CombatService` документировать ephemeral semantics, bounds, timeout и
   shutdown. Combat hot state в PostgreSQL не переносить.
5. Module factory должен падать при отсутствии database/content dependencies.

### Acceptance gate

- поиск по `src` не находит production `Memory*`, fake repository,
  passthrough UoW или `storageDriver === "memory"`;
- запуск без `DATABASE_URL`/published content завершается явной ошибкой;
- restart E2E сохраняет hero, inventory и content revision; mid-fight restart
  явно прекращает бой и не оставляет частичных persistent effects;
- process-memory allowlist содержит ephemeral transport и active combat state с
  documented loss behavior;
- PostgreSQL сохраняет только завершённую `finished_fights` history на 72 часа;
- test fakes находятся только в `tests/support`.

## Фаза 5. Типизированный статический command dispatch

Статус: выполнена. OA/fproxy/esrv идут через exact DTO и immutable registries из
static imports. `ObjectActionRouter` удалён; `AmfValue` остаётся в codec/framing
и `toAmfValue`.

### Работы

1. Составить исчерпывающий список текущих command keys без расширения scope:
   OA `common|init`, `common|init2`, `user|bag`,
   `common|object:ATTACK_BOT`; текущие fproxy auth/poll/castSpell и esrv poll/exit.
2. Для каждого создать exact request/response DTO, decoder, mapper и маленький
   handler descriptor.
3. Создать immutable OA/fproxy/esrv registries из static imports.
4. Оставить `AmfValue` только в codec/framing и low-level decoder/encoder.
5. Свести Fastify transport к raw body/cookie, decode, lookup, invoke, encode и
   error mapping.
6. Unknown/malformed/no-session/internal cases развести по точным status/shape.
7. Добавить registry uniqueness/coverage checks и raw-AMF E2E для каждого
   текущего command family.

### Acceptance gate

- application/domain/ports/repositories не импортируют `AmfValue`;
- production не содержит `import()`/`await import()` или directory scan dispatch;
- каждый текущий command key присутствует ровно в одном registry;
- handlers не импортируют Fastify/Drizzle и не принимают generic AMF maps;
- `ObjectActionRouter` больше не участвует в runtime;
- baseline fixtures и negative E2E совпадают по wire.

## Фаза 6. Разделение файлов и module factories

Статус: выполнена. Composition root соединяет module factories; HTTP auth/OA/esrv/fproxy
и static/TLS разделены; handwritten production не превышает 400 строк; allowlist
multi-export пуст.

### Работы

1. Создать factories для identity, character, inventory, catalog, world, combat и
   jugger-wire; вернуть только public application interfaces и lifecycle.
2. Оставить верхнему bootstrap создание process resources и соединение public
   module interfaces.
3. Разделить перечисленные в baseline multi-export files по одному основному
   class/interface на файл. Когезионные DTO unions оставить вместе.
4. Разделить HTTP adapter на auth routes, OA transport, fproxy transport, esrv
   transport и static/TLS bootstrap.
5. Ввести CI check 250-line report и 400-line hard failure для handwritten
   production; generated/migrations исключать по точным путям.
6. Добавить import-boundary checks между domain/application/infrastructure.

### Acceptance gate

- handwritten production files не превышают 400 строк;
- каждый файл выше 250 строк имеет review justification и reduction issue;
- нет файла с несколькими primary exported classes/interfaces вне временного
  allowlist; allowlist пуст к концу фазы;
- top-level bootstrap не импортирует concrete repositories/command handlers;
- каждый module factory имеет startup failure и cleanup tests;
- dependency checks не находят Fastify/Drizzle/AMF в domain/application.

## Фаза 7. Консолидация E2E-first

Статус: выполнена. Playable slice разбит на независимые raw-AMF E2E через
Fastify/PostgreSQL; каталог `tests/contract` удалён; `TEST_DATABASE_URL` падает
до первого DB/E2E теста.

### Работы

1. Проверить test DB guard, migration setup и изолированные builders в
   `tests/support`, введённые в фазе 1.
2. Разделить playable slice на короткие независимые E2E: auth/init,
   unsupported, hunt/start fight, fproxy, esrv exit/reconnect.
3. Удалить application/contract tests, которые только дублируют эти сценарии.
   Сохранить unit codecs/framing/state machines и integration
   transactions/locking/migrations/content publication.
4. Добавить restart и concurrent cases там, где они подтверждают persistence.
5. Настроить стандартные scripts/CI так, чтобы DB suite не skip-алась.

### Acceptance gate

- каждый OA/fproxy/esrv текущего scope имеет raw-AMF E2E через Fastify/PostgreSQL;
- E2E не импортируют private handlers/repositories и не используют fixed dev
  account/slot;
- suites проходят отдельно, вместе и в разрешённом parallel mode;
- unit/integration каталоги содержат только категории из `docs/TESTING.md`;
- отсутствие/опасный `TEST_DATABASE_URL` падает до первого теста;
- build/lint/all tests зелёные без skipped и forced exit.

## Фаза 8. Удаление заменённого кода

Статус: требует closeout по ADR-0015. Superseded adapters, memory repositories,
`ObjectActionRouter` и каталог `migrations/` отсутствуют, но combat schema всё
ещё содержит ненужные active/event tables.

### Работы

1. Проверить отсутствие raw-postgres adapters, старого migration runner и
   `migrations/0001_initial.sql`, удалённых в предыдущих фазах.
2. Удалить старый direct content importer/game-policy content path.
3. Удалить `ObjectActionRouter`, старый generic parsing, production memory graph,
   старые ID sources и неиспользуемые exports.
4. Удалить дублирующие tests, fixtures, config fields и временные allowlists.
5. Заменить `combat.fights/participants/events` на подтверждённую старым
   эмулятором `finished_fights` history; добавить отдельный 72-hour cleanup.
6. Проверить dependency graph, dead files и scripts; не оставлять compatibility
   wrappers без runtime caller.
7. Обновить только эксплуатационные документы, которых фактически коснулась
   реализация; исторические ADR сохраняются.

### Acceptance gate

- поиск не находит imports/callers superseded implementations;
- clean clone выполняет install → migrate → publish test content → E2E;
- единственный production storage path — Drizzle/PostgreSQL;
- combat storage содержит только finished history; active state и event log в
  PostgreSQL отсутствуют;
- единственный client command path — exact DTO + static registry;
- production memory repositories и dynamic dispatch отсутствуют;
- hard line/import/AmfValue checks включены в CI;
- wire baseline и весь test/build/lint набор зелёные.

## Общие правила выполнения

- Каждый PR меняет один инфраструктурный инвариант и не добавляет gameplay.
- Wire fixture меняется только с отдельным доказательством, не как побочный эффект
  refactor.
- Временный adapter имеет caller, owner и фазу удаления; «пригодится позже» не
  является причиной оставить код.
- При конфликте приоритеты: wire fidelity, целостность PostgreSQL, fail-fast,
  затем удобство реализации.
- Если acceptance gate не автоматизирован, PR содержит точную ручную команду и
  последующую задачу автоматизации; финальная фаза ручных gates не оставляет.

## Финальное определение готовности

Foundation refactor завершён, когда текущий playable slice работает без изменения
gameplay через typed static commands, Drizzle и published PostgreSQL content;
E2E проходит через реальные Fastify routes/raw AMF/изолированную БД; production
не содержит memory repositories, кроме ADR-0015 active combat state; module
factories и файловые лимиты соблюдены;
заменённый код удалён, а не оставлен вторым путём.
