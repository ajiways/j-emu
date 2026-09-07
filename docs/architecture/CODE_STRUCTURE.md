# Структура кода

## Цель

Структура должна делать владельца поведения и направление зависимостей видимыми
из пути и имени файла. Правила ниже применяются к handwritten production code.
Generated codecs и migrations исключены из лимитов, но должны находиться в явно
обозначенных каталогах.

## Один основной тип на файл

В production-файле экспортируется один основной class или interface. Имя файла
соответствует этому типу. Разрешены связанные private helpers и небольшая
когезионная DTO-family одной команды/события:

- request, response и error variants одной клиентской команды;
- union вариантов одного domain event;
- options/config type, принадлежащий единственной factory/class.

Не считаются когезионной DTO-family несколько repositories, services, ID sources
или domain entities, объединённых общей тематикой. Они получают отдельные файлы.
Barrel может только re-export публичный контракт и не содержит реализацию.

## Лимиты размера

- 250 строк: обязательный review threshold. Автор объясняет, почему файл остаётся
  когезионным, либо делит его до review.
- 400 строк: жёсткий лимит handwritten production file.
- Generated codecs и migrations не учитываются; ручной код рядом с генерацией
  выносится отдельно.

Пустые строки и comments входят в практический размер: длинное объяснение обычно
означает, что ответственность тоже стоит разделить. Лимит не является целью:
файл на 180 строк с двумя независимыми обязанностями всё равно нарушает правило.

## Модули и слои

```text
src/
  app/                         # верхнеуровневый bootstrap
  modules/<name>/
    domain/
    application/
    ports/
    infrastructure/
    contracts/                 # только опубликованные межмодульные типы
    module.ts                  # factory и public module interface
  infrastructure/              # общие process adapters
  shared/kernel/               # минимальные стабильные primitives
```

Domain/application не импортируют Fastify, AMF, Drizzle schema или process
singletons. Infrastructure реализует ports. Межмодульный вызов идёт через
публичный application interface, переданный factory.

## Module factories

Каждый модуль предоставляет factory, которая:

1. получает config и внешние ports явными аргументами;
2. создаёт только внутренние repositories/services/handlers модуля;
3. возвращает небольшой public module interface;
4. регистрирует cleanup hooks;
5. fail-fast проверяет обязательные dependencies.

Верхнеуровневый bootstrap создаёт database/process resources, вызывает factories
и соединяет их public interfaces. Он не знает каждый repository, handler, policy
и DTO. Условное ветвление по storage implementation внутри composition root
запрещено. Это устраняет giant composition root без service locator и
скрытых globals.

## Persistence

Production runtime использует PostgreSQL через Drizzle. Production memory
repositories, in-memory ID sources и passthrough Unit of Work запрещены.
Тестовые fakes находятся только в `tests/support`; production module никогда не
выбирает fake по config/env.

Process memory разрешена для явно описанного ephemeral transport state и hot
state активного боя по ADR-0015. Для каждого такого объекта документируются:

- почему потеря при restart безопасна;
- существует ли persisted source of truth;
- как ограничены размер и lifetime;
- как выполняется shutdown/cleanup.

Accounts, sessions, heroes, inventory, content, fight IDs и delivery cursor не
относятся к ephemeral transport state.

Текущий allowlist:

- `LongPollCoordinator` — набор AbortController для esrv/fproxy waiters.
  Restart безопасен: клиент повторяет poll. Persisted source of truth нет,
  очередь боя живёт в `CombatService` до exit. Bound: один waiter на
  соединение; shutdown abort-ит всех.
- TCP/AMF framing buffer в fight connection — байты текущего сокета. Restart
  рвёт соединение; клиент открывает новый fproxy.
- `CombatService` in-progress battles — не transport. Потеря при restart
  является постоянной политикой: active state не восстанавливается и не
  записывается в PostgreSQL. До terminal settlement persistent hero/inventory
  не изменяются. После finish сохраняется только history row на 72 часа.

## IDs и БД

Persisted runtime ID генерирует только PostgreSQL sequence/identity/default.
Application policy не выдаёт ID. JavaScript number не используется для
PostgreSQL `bigint`, если возможна потеря точности. Foreign IDs между модулями
остаются opaque и не дают права изменять чужие tables.

Drizzle schema принадлежит модулю. Миграции генерируются/проверяются единым
toolchain и проходят на чистой и уже мигрированной test database. Runtime не
исполняет ad-hoc DDL.

## Транспорт и команды

Fastify adapters регистрируют routes и переводят bytes/cookies в wire boundary.
Точные команды организованы по правилам `CLIENT_COMMANDS.md`. Большой router,
который одновременно парсит несколько commands и вызывает domain services,
нарушает структуру независимо от числа строк.

## Автоматические проверки

`npm run check` проверяет:

- production `.ts` file не превышает 400 строк;
- файл с несколькими exported classes/interfaces находится в явном allowlist
  только на время миграции;
- `Memory*`, fake implementations и passthrough UoW отсутствуют в `src`;
- dynamic import отсутствует в production command dispatch;
- `AmfValue` не выходит за codec/framing/low-level wire decoder/encoder;
- Fastify и Drizzle imports не попадают в domain/application;
- test fakes находятся под `tests/support`;
- Knip не находит unused files, exports/types, dependencies, unresolved imports,
  duplicate exports и dependency cycles; entry exports также проверяются.

Текущая проверка — `npm run check:architecture` (`scripts/check-architecture.ts`).
Allowlist multi-export и 250-line justifications в этом скрипте пусты.
Отклонений handwritten production files нет.
