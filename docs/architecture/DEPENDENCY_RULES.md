# Правила зависимостей

## 1. Направление кода

В каждом модуле слои направлены внутрь:

```text
transport / subscribers -> application -> domain
storage / publishers ----^            <- ports
```

- `domain` импортирует только стандартную библиотеку, собственные value objects и ports.
- `application` импортирует свой domain и публичные contracts других модулей.
- `adapters` реализуют ports; ORM, Fastify, AMF, очереди и часы находятся здесь.
- `contracts` содержит команды, ответы, события и стабильные ID. В нём нет ORM rows, wire DTO и runtime singletons.
- Внешний модуль импортируется только через `<module>/contracts` или его внедрённый API interface.

Синхронный вызов используется, когда ответ нужен для решения текущей команды. Событие используется для уведомления о подтверждённом факте. Нельзя публиковать событие вида `please-do-X`.

## 2. Разрешённые связи

| Потребитель   | Синхронно может вызывать                                            | Асинхронно потребляет                    |
| ------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| `jugger-wire` | bootstrap query, публичные API всех сценариев                       | события для push/read models             |
| `character`   | catalog query для validation/rules                                  | combat outcome, inventory equipment view |
| `inventory`   | catalog item query                                                  | catalog revision                         |
| `world`       | catalog creature query                                              | combat finished, instances lifecycle     |
| `combat`      | только собственное storage; snapshots передаются во входной команде | abort/lease commands через inbox         |
| `quests`      | свои definitions/state                                              | combat/world/inventory/character signals |
| `social`      | identity/character display query                                    | character rename, instances lifecycle    |
| `economy`     | inventory reservation API, catalog price query                      | reservation expired                      |
| `professions` | inventory reservation API, catalog/world query                      | timer, catalog revision                  |
| `instances`   | world admission API, combat start API, social party query           | combat finished, party changed           |
| `content`     | validation ports                                                    | ничего из gameplay runtime               |
| `catalog`     | ничего                                                              | publication bundle                       |

Если появляются два встречных синхронных вызова, граница неверна. Координацию выносить в application saga, а не добавлять обратный import.

## 3. Владение Postgres

На старте это один процесс и один PostgreSQL. Границы защищаются API и
владением записи, а не искусственным воспроизведением сетевых ограничений.

- Модуль определяет свои Drizzle tables и один изменяет их.
- Прямой `INSERT`/`UPDATE`/`DELETE` в таблицы другого модуля запрещён.
- FK между модулями разрешены для целостности стабильных ссылок, пока модули
  находятся в одной БД.
- Application orchestrator может вызвать несколько module API в одной Drizzle
  transaction, если сценарий требует немедленной атомарности.
- Saga/outbox нужны для асинхронного сценария, внешнего side effect или уже
  извлечённого сервиса, а не для каждой операции заранее.
- Выделенный read model может делать read-only join для конкретного экрана. Он
  не является write API и не возвращается в domain как aggregate.

Допустимая денормализация — только projection с указанными source events, watermark и rebuild procedure. Копирование поля «для удобного join» в transactional aggregate запрещено.

## 4. Доменные события

Обязательный envelope:

```text
eventId, eventType, eventVersion, aggregateId, aggregateVersion,
operationId, occurredAt, correlationId, causationId, payload
```

- Событие записывается в outbox в одной транзакции с агрегатом.
- Публикация at-least-once; consumer inbox обеспечивает exactly-once effect.
- Порядок гарантируется только для одного aggregate.
- Breaking change создаёт новую версию события; старые consumers поддерживаются до миграции.
- Payload содержит факт и минимальный snapshot, необходимый подписчику; не содержит ORM row.
- Subscriber не вызывает автора события обратно в той же цепочке.

## 5. `init/init2`

`jugger-wire` владеет AMF envelope, но не становится владельцем gameplay-данных:

1. выделенный `BootstrapQuery` читает согласованный typed snapshot через Drizzle;
2. query использует ограниченное число запросов/joins без N+1;
3. wire mapper создаёт плоские блоки `common|init`/`init2`, `state` и live quirks.

Запрещены:

- gameplay mutation из bootstrap query;
- N+1 вызовы модулей на обычном init;
- хранение готового AMF как источника истины;
- доменные решения по отсутствующему wire-полю.

Persisted projection вводится только после измеренного узкого места отдельным
ADR. Одновременные direct query и projection с переключением при ошибке
запрещены.

## 6. Anti-corruption layer `jugger-wire`

- OA names, AMF types, `status: 100/203/204`, `money_gold`, cookie и CEF quirks существуют только здесь.
- Wire DTO преобразуется в доменную command до вызова API.
- Доменная ошибка типизирована (`NotAuthorized`, `Conflict`, `RuleViolation`); выбор wire status/error делает mapper.
- fproxy/esrv — transports, а не API combat/social.
- Contract fixtures проверяют byte/shape compatibility; доменные тесты AMF не импортируют.

Новый transport не переиспользует wire mapper: он вызывает те же application API и имеет свои DTO.

## 7. Подготовка к извлечению `combat`

Combat считается extractable только при одновременном выполнении условий:

- `startCombat` принимает полные immutable snapshots участников, ruleset/catalog revision и idempotency key;
- все последующие команды адресуются по `combatId`, содержат expected version и не читают character/inventory/world;
- RNG детерминирован seed, clock и ID generator внедрены;
- active state, turns, effects и packets остаются в памяти процесса-владельца;
- sticky routing направляет команды конкретного боя одному owner;
- restart/потеря owner прекращает незавершённый бой по явному wire-сценарию;
- terminal settlement фиксируется до публикации `combat.finished`;
- награды, квестовый прогресс, durability, location и instance checkpoint применяют внешние subscribers/saga;
- reconnect при живом owner получает `CombatView`, не ссылку на mutable объект;
- PostgreSQL получает только finished history row с TTL 72 часа;
- contract/load/replay tests проходят против in-process и remote adapter.

После физического выделения application port заменяется RPC-клиентом, а routing
закрепляет fight за instance combat-service. Доменные модули и `jugger-wire` не
меняются. Network failure возвращает явную retryable/terminated ошибку; он не
превращается в поражение или пустой `status:100`. Требование переносить active
fight на другой process потребует нового ADR и не реализуется event log в
PostgreSQL заранее.

## 8. Внешние playerbots

Playerbots — будущий внешний consumer, не модуль сервера.

- Он регистрирует/получает обычные accounts и characters и действует через тот же публичный protocol/API.
- В gameplay DB нет `is_bot`, bot profiles, brain, intents, session logs и специальных market observations.
- Character/combat/economy/quests не знают происхождение команды.
- Reward, drop, цены, cooldown и ограничения зависят от режима боя/мира и состояния персонажа, а не от типа клиента.
- Онлайн определяется active session/presence lease одинаково для всех.
- Планирование, привычки, wishlist, pathfinding и AI combat остаются в БД/процессе consumer.
- Техническая service credential допустима только на gateway для rate limits, quota и observability; её subject не попадает в доменную модель и не меняет правила игры.
- Для массового создания разрешён idempotent provisioning endpoint, создающий обычные сущности через те же application services.

Тест на это правило: один и тот же command trace, отправленный wire-клиентом и внешним consumer, даёт одинаковые доменные события при одинаковом initial state/RNG.

## 9. Content publication

- Editor пишет только versioned `content` drafts в том же PostgreSQL.
- Publish создаёт immutable, checksum-verified logical bundle в PostgreSQL.
- Каждый владелец (`catalog`, `world`, `quests`, `instances`, `professions`)
  валидирует свою часть candidate revision до активации.
- Активная revision меняется атомарно, когда весь bundle совместим.
- SQLite, object storage, отдельный content-service и broker на первом этапе не
  вводятся.
- Dual-write JSON + runtime tables и runtime-чтение fixtures запрещены.
- Неподдерживаемое поле — validation error, а не `extraJson`.

## 10. Автоматическое соблюдение

Сейчас `npm run check` и precommit проверяют:

- 400-line / multi-export / `Memory*` / `import()` / `AmfValue` / Fastify и
  Drizzle в domain/application (`check:architecture`);
- Knip: unused files, exports, dependencies, unresolved imports, cycles;
- ESLint и Prettier.

`npm run test:all` добавляет:

- unit codecs/framing/state machines и fail-fast `TEST_DATABASE_URL`;
- integration: clean/repeat migrate, Unit of Work rollback, sequence IDs,
  content publication;
- raw-AMF E2E через Fastify и изолированный PostgreSQL.

План, ещё не автоматизировано:

- import-boundary test: запрет `*/adapters` и `*/storage` между модулями;
- write-ownership test: модуль не изменяет чужие Drizzle tables;
- event schema compatibility check;
- поиск `isBot` / `playerbot` вне docs/внешнего consumer.

Исключение требует ADR с владельцем, сроком удаления и CI allowlist. Комментарий
в коде не является исключением.
