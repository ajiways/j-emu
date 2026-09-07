# Дорожная карта миграции

## Назначение и границы

Этот документ задаёт порядок переноса эмулятора в новый репозиторий `j-emu`. Целевой продукт — совместимый с существующим Flash/CEF-клиентом сервер для игрового цикла персонажа уровней 1–8. Wire-контракт сохраняется; внутренняя архитектура переносится заново, без копирования сложившейся структуры модулей.

Решения ниже основаны только на просмотренных источниках старого `jgr-emu` и исследовательских материалах. Матрица не утверждает исчерпывающий паритет со старым сервером или live: непроверенные OA, поля, ветви клиента и игровые механики должны считаться неизвестными до появления дампа, AS3-свидетельства или контрактного теста.

`jgr-emu`, `_research`, dumps и fixtures являются read-only evidence/import
corpus. Код старого runtime не переносится и не становится зависимостью
`j-emu`; правило подробно зафиксировано в [SOURCE_BOUNDARY.md](SOURCE_BOUNDARY.md).

Основные источники:

- [продуктовый инвентарь старого эмулятора](../../../jgr-emu/docs/CAPABILITIES.md);
- [архитектура и request flow](../../../jgr-emu/docs/ARCHITECTURE.md);
- [wire-находки](../../../jgr-emu/docs/PROTOCOL.md);
- [проверенный краткий протокол](../../../_research/02_protocol.md);
- [старые правила запуска и сидов](../../../jgr-emu/docs/RUN.md);
- [границы тестового окружения](../../../jgr-emu/docs/TESTING.md).

`WIRE_INVARIANTS.md` — нормативная граница совместимости для каждого миграционного среза. При конфликте «удобной» новой модели с подтверждённым wire выигрывает wire.

## Матрица решений

| Область                                                                                | Решение                                                      | Что именно входит в решение                                                                                               | Основание и ограничение                                                                                                                                                                             |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP(S), TLS для старого CEF, страницы входа и `game.php`                              | **Реализовать заново**                                       | Новый bootstrap HTTP-сервера; сохранить клиентские URL, legacy TLS при необходимости и выдачу FlashVars                   | Старые точки входа перечислены в [`src/main.ts`](../../../jgr-emu/src/main.ts) и [`docs/ARCHITECTURE.md`](../../../jgr-emu/docs/ARCHITECTURE.md)                                                    |
| AMF3 codec и length-prefixed MULTI                                                     | **Сохранить контракт, код реализовать заново**               | Bare AMF3 для OA/SINGLE; `u32be length + AMF3` для MULTI; зеркалирование `sq`                                             | [`src/routes/entryPoint.ts`](../../../jgr-emu/src/routes/entryPoint.ts), [`src/fight/dispatch.ts`](../../../jgr-emu/src/fight/dispatch.ts), [`docs/PROTOCOL.md`](../../../jgr-emu/docs/PROTOCOL.md) |
| Сессии и CEF-cookie flow                                                               | **Сохранить поведение, реализовать заново**                  | `PHPSESSID`; мягкое отношение к устаревшему `sess_key`; установка cookie в HTTP 200 `/game.php`                           | [`src/routes/auth.ts`](../../../jgr-emu/src/routes/auth.ts)                                                                                                                                         |
| `entry_point.php`, OA dispatch и flat response                                         | **Сохранить wire, реализовать заново**                       | Ключи `object\|action`, `state`, `sq`; flat init/equip; точные status/error правила                                       | [`src/routes/entryPoint.ts`](../../../jgr-emu/src/routes/entryPoint.ts), [`docs/PROTOCOL.md`](../../../jgr-emu/docs/PROTOCOL.md)                                                                    |
| Персонаж, state, bag/pocket/magic/paperdoll, предметы                                  | **Сохранить продукт и данные, домен реализовать заново**     | Персистентный герой, каталог артикулов, инстансы предметов, экипировка, стаки, durability и подтверждённые USE-операции   | Инвентарь возможностей в [`docs/CAPABILITIES.md`](../../../jgr-emu/docs/CAPABILITIES.md); wire-ограничения — в `WIRE_INVARIANTS.md`                                                                 |
| Мир, переходы, hunt, presence                                                          | **Сохранить продукт, реализовать заново**                    | Локации, переходы, hunt-spawn/lock, roster и reconnect; authored content переносить как контент, не как runtime-снимок    | [`docs/CAPABILITIES.md`](../../../jgr-emu/docs/CAPABILITIES.md), [`src/routes/esrv.ts`](../../../jgr-emu/src/routes/esrv.ts)                                                                        |
| Бой и `fproxy`                                                                         | **Сохранить подтверждённый wire, движок реализовать заново** | Сессия боя, poll, L/C/R, pocket, glove, rage/aggro, finish/exit/loot и reconnect                                          | [`src/fight/dispatch.ts`](../../../jgr-emu/src/fight/dispatch.ts), [`src/fight/wire.ts`](../../../jgr-emu/src/fight/wire.ts), [`docs/FIGHT_CAST_ACK.md`](../../../jgr-emu/docs/FIGHT_CAST_ACK.md)   |
| Квесты и NPC для целевого цикла 1–8                                                    | **Сохранить контент, исполнение реализовать заново**         | Curated-цепочка, board/dialog/book/AREA, цели и скрипты; мигрировать нормализованные данные после утверждения новой схемы | Текущий охват и известные дыры: [`docs/CAPABILITIES.md`](../../../jgr-emu/docs/CAPABILITIES.md)                                                                                                     |
| Чат, личные/area push, party                                                           | **Сохранить минимально нужный продукт, реализовать заново**  | Long-poll, каналы `2:`, `4:`, `131:`, chat fan-out и подтверждённый party flow                                            | [`src/routes/esrv.ts`](../../../jgr-emu/src/routes/esrv.ts), [`docs/PROTOCOL.md`](../../../jgr-emu/docs/PROTOCOL.md)                                                                                |
| Магазин, почта, аукцион, обмен                                                         | **Реализовать заново после core loop**                       | Только подтверждённые OA и транзакционные инварианты; не переносить внутренние вызовы playerbots                          | Старый охват: [`docs/CAPABILITIES.md`](../../../jgr-emu/docs/CAPABILITIES.md)                                                                                                                       |
| Данжи, профессии и Раскоп                                                              | **Отложить**                                                 | Переносить после стабильного одиночного цикла 1–8, боя, квестов и social core; каждый блок отдельным вертикальным срезом  | Эти области работали, но значительно расширяют состояние и фоновые процессы; [`docs/CAPABILITIES.md`](../../../jgr-emu/docs/CAPABILITIES.md)                                                        |
| Арена вне Раскопа, achievements, seals, mounts, companions, campaigns, friend gameplay | **Отложить**                                                 | Не заменять фиктивным `status:100`; разрешён честный совместимый отказ                                                    | В старом inventory это stub/частичная реализация; [`docs/CAPABILITIES.md`](../../../jgr-emu/docs/CAPABILITIES.md)                                                                                   |
| Clan, fishing, полный FAQ/menu hub                                                     | **Удалить из миграционного scope**                           | Не переносить домен, таблицы и специальные сервисы; неизвестные/запрещённые операции отвечают по wire-контракту           | Старый scope явно исключает эти области; [`docs/CAPABILITIES.md`](../../../jgr-emu/docs/CAPABILITIES.md)                                                                                            |
| Dev content editor и диагностические endpoints                                         | **Отложить**                                                 | Сначала определить стабильные схемы контента и API; затем вынести инструменты из игрового runtime                         | Старый редактор совмещён с сервером в [`src/main.ts`](../../../jgr-emu/src/main.ts); это не клиентский wire                                                                                         |
| Playerbots                                                                             | **Полностью удалить**                                        | Не переносить код, таблицы, workers, env, API, метрики, тесты и bot-specific ветви домена                                 | Полный охват старой подсистемы: [`docs/PLAYERBOTS.md`](../../../jgr-emu/docs/PLAYERBOTS.md)                                                                                                         |

## Обязательное удаление playerbots

Миграция не должна начинаться с `PLAYERBOTS_ONLINE=0`. Отключённый код остаётся архитектурной зависимостью. Требуется полное отсутствие playerbots в новом runtime:

1. **Код:** не переносить каталог [`src/playerbots/`](../../../jgr-emu/src/playerbots), bot bootstrap/shutdown из [`src/main.ts`](../../../jgr-emu/src/main.ts), bot-only reward branches, dev API, scripts и импорты из боёв, аукциона, логирования и метрик.
2. **Таблицы и колонки:** не создавать `accounts.is_bot`, индекс `accounts_is_bot_idx`, `playerbot_brains`, `playerbot_profiles`, `playerbot_intents`, `playerbot_session_log`, `playerbot_meta`; не переносить bot-only поля рыночного журнала (`seller_is_bot`, `buyer_is_bot`) без отдельной общей продуктовой причины. Старые определения находятся в [`src/db/schema.ts`](../../../jgr-emu/src/db/schema.ts).
3. **Workers и таймеры:** не переносить online scheduler, grind pump, market price worker, economy diagnostics, auto-registration, session drain и playerbot load metrics. Старые точки жизненного цикла видны в [`src/main.ts`](../../../jgr-emu/src/main.ts).
4. **Конфигурация:** исключить `PLAYERBOTS*`, `PLAYERBOT_*` и связанные live overrides. Старый перечень находится в [`src/config.ts`](../../../jgr-emu/src/config.ts).
5. **Тесты:** не переносить `src/playerbots/**/*.test.ts`, `*.db.test.ts`, их импорты в DB-suite и playerbot-скрипты в [`package.json`](../../../jgr-emu/package.json). Общие доменные правила, случайно проверявшиеся только bot-тестом, сначала формулируются заново как player-agnostic contract test.
6. **Данные:** bot-аккаунты, bot-сессии, brain/profile/intent/session-log/meta и bot-generated market state не входят в импорт пользовательских данных. Если исторические рыночные события когда-либо понадобятся, их происхождение очищается отдельной явной политикой, а не скрытой bot-ветвью.

Будущие playerbots допустимы **только как внешний сервис**. Такой сервис создаёт обычные аккаунты и использует те же публичные HTTP/AMF endpoints, cookie/session flow, rate limits и права, что и клиент. Запрещены прямой импорт серверных доменных модулей, доступ к основной БД, внутрипроцессные hooks хода, привилегированный reward multiplier и скрытые bot-only поля wire. API для него не проектируется в этой миграции.

Критерий завершения удаления: поиск по новому репозиторию не находит `playerbot`, `PLAYERBOT`, `is_bot`, `bot:` в runtime/schema/tests/config (кроме исторической записи в этом документе), а миграции с чистой БД не создают перечисленные таблицы и колонки.

## Порядок вертикальных срезов

### 0. Зафиксировать доказательства

- Собрать минимальный versioned corpus обезличенных OA, esrv и fproxy запросов/ответов.
- Для каждого fixture записать происхождение: live dump, AS3, старый runtime или гипотеза.
- Превратить инварианты из `WIRE_INVARIANTS.md` в golden/contract tests.
- Не объявлять parity для OA, которого нет в просмотренном corpus.

### 0.5. Привести foundation к целевой архитектуре

Статус: выполнено. Persistence — Drizzle/PostgreSQL; content — drafts/releases;
клиентские команды — static registry; E2E — Fastify + `_test` БД. Детали —
[FOUNDATION_REFACTOR.md](../refactoring/FOUNDATION_REFACTOR.md).

- Перевести persistence и миграции на Drizzle, удалить production memory
  persistence и process-local генераторы persisted ID.
- Ввести PostgreSQL drafts/releases и явный dependency graph импорта контента.
- Разделить transport, typed command registry и handlers до добавления новых OA.
- Перенести основной harness на отдельный PostgreSQL `_test`.

### 1. Транспорт и сессия

- HTTP/HTTPS, обязательные URL, raw body parsers, AMF3 SINGLE и MULTI framing.
- Login → redirect → `/game.php` с cookie в 200.
- `entry_point` no-auth и `sq`; пустой authenticated esrv/fproxy poll.

Результат среза: клиент получает страницу, сохраняет сессию и выполняет диагностический OA без рассинхронизации framing.

### 2. Bootstrap персонажа

- Минимальная схема accounts/sessions/heroes/hero_info/items/catalog.
- `common|init`, `common|init2`, `state`, bag/pocket/magic/view/unitframe.
- Flat top-level response и tutorial flags.

Результат: персонаж входит в локацию, UI загружается после холодного старта и повторного входа.

### 3. Инвентарь и экипировка

- PUT_ON/PUT_OFF/DROP, стаки, bag capacity, pocket layout, stat recalculation.
- Полный flat equip response; стабильные item ids.
- Сначала core item actions, затем подтверждённые USE-пайплайны.

Результат: после каждой мутации серверное состояние, init после reconnect и UI совпадают.

### 4. Мир, hunt и realtime

- Area config, COME_IN/exit, hunt spawns/locks, presence и каналы esrv.
- Явное разделение персистентного мира и process-local ожиданий.
- Reconnect и очистка stale locks/sessions тестируются отдельно.

Результат: два изолированных пользователя видят согласованные переходы, roster и занятость hunt.

### 5. Бой end-to-end

- `fight|conf`, fproxy auth/poll, удары, очередь событий, finish → esrv `fight|exit` → finish/loot.
- Pocket/glove/native ordering из `WIRE_INVARIANTS.md`.
- Никаких обещаний live-формул урона: сначала wire и детерминированность, затем баланс по отдельным свидетельствам.

Результат: клиент завершает бой без 60-секундного зависания, а инвентарь/HP/XP переживают reconnect.

### 6. Квестовый цикл 1–8

- NPC board/dialog/book, цели, AREA waiting, quest fights, награды и маркеры.
- Контент переносится порциями с собственными acceptance fixtures.
- Известные старые дыры не маскируются статусом «готово».

Результат: чистый герой проходит утверждённую цепочку от начала до конца без ручного патча БД.

### 7. Социальные и экономические подсистемы

- Чат и party — раньше экономики.
- Store, mail, auction, trade — отдельными срезами с транзакционными и race-тестами.
- Ни одна подсистема не получает bot-only shortcut.

### 8. Отложенные продуктовые блоки

Профессии, данжи, Раскоп и инструменты контента принимаются по одному после стабилизации core loop. Для каждого блока сначала обновляется эта матрица на основе новых просмотренных источников; факт работы в старом эмуляторе сам по себе не является достаточным контрактом.

## Качество и ворота

Каждый срез проходит все применимые ворота:

1. **Scope gate:** изменяется только заявленный срез; нет скрытого переноса playerbots или отложенных фич.
2. **Evidence gate:** каждому новому wire-полю или порядку событий соответствует ссылка/fixture; гипотеза явно помечена и не выдаётся за parity.
3. **Protocol gate:** golden tests проверяют байтовое framing, верхнеуровневые ключи, `sq`, status/error и порядок realtime-пакетов.
4. **Schema gate:** миграции накатываются с нуля и вперёд; runtime не читает fixtures как player-state; playerbot-объекты отсутствуют.
5. **Isolation gate:** e2e и integration тесты работают только с отдельной
   PostgreSQL test-БД с суффиксом `_test`, создают изолированных героев и не
   используют memory persistence или dev-прогресс. Правила:
   [`docs/TESTING.md`](../TESTING.md).
6. **Reconnect gate:** критическая мутация подтверждается холодным reload/reconnect, а не только текущим in-memory состоянием.
7. **Concurrency gate:** hunt lock, mail/auction/trade settlement и выдача наград имеют тест на повтор/гонку там, где возможна двойная запись.
8. **Client gate:** утверждённый сценарий проходит в реальном Flash/CEF-клиенте; server-only тест не доказывает UI-совместимость.
9. **Build gate:** форматирование, статическая проверка, основные e2e,
   релевантные integration и выборочные unit/contract тесты завершаются без
   skipped/cancelled и forced exit.
10. **Documentation gate:** `WIRE_INVARIANTS.md` обновлён при новом подтверждённом контракте; расширение продуктового охвата отражено здесь, но не объявляется исчерпывающим.

## Определение готовности миграции core

Core-миграция готова, когда чистая БД разворачивается одной командой, новый герой проходит утверждённый цикл 1–8 в клиенте, критические reconnect/concurrency сценарии зелёные, а новый runtime не содержит playerbots. Это не означает полный паритет с live или всеми возможностями старого `jgr-emu`.
