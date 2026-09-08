# Дорожная карта переноса

## Цель

Переписать рабочий цикл персонажа уровней 1–8 из `jgr-emu` под архитектуру
`j-emu`, сохранив поведение существующего Flash/CEF-клиента.

`jgr-emu` задаёт поведенческий baseline, но не архитектуру. Новый runtime:

- использует typed DTO, static command registry и public module ports;
- хранит persistent state в PostgreSQL через Drizzle;
- публикует authored content через drafts/releases;
- не читает старые fixtures во время игрового запроса;
- не содержит clan и встроенных playerbots.

Правила источников: [SOURCE_BOUNDARY.md](SOURCE_BOUNDARY.md). Текущий продуктовый
статус: [CAPABILITIES.md](../CAPABILITIES.md). Источники по срезам:
[EVIDENCE_INDEX.md](EVIDENCE_INDEX.md).

## Как переносится capability

1. Выбрать рабочую строку legacy
   [CAPABILITIES.md](../../../jgr-emu/docs/CAPABILITIES.md) внутри текущего
   среза.
2. Прочитать весь старый сценарий: routes, application/domain rules, persistence,
   wire mapping, docs и content.
3. Записать адаптированный контракт в модульном документе `j-emu`.
4. Реализовать сценарий заново без импорта старого runtime-кода.
5. Перенести authored data через content publication.
6. Проверить raw-AMF/Fastify/PostgreSQL E2E и один реальный client scenario.
7. Изменить статус только в `docs/CAPABILITIES.md`.

Повторный request-by-request research не требуется для поведения, которое уже
работает в старом клиенте. Он нужен при конфликте evidence, неизвестном wire,
регрессе или старой пометке stub/bug.

## Срезы

### 0. Foundation — готово

Drizzle/PostgreSQL, content releases, database IDs, static typed dispatch,
E2E harness, quality gates и process-local active combat уже заданы.

Исторический план находится в
[archive/FOUNDATION_REFACTOR.md](../archive/FOUNDATION_REFACTOR.md).

### 1. Client, auth и bootstrap — готово

Перенос:

- HTTPS `s1.jugger.ru:443`, legacy CEF TLS и Pub1 paths;
- login/register/session/cookies и `/game.php`;
- `common|init`, `common|init2`, state, personal details;
- bag, pocket, magic, view, skills, unitframe, area config;
- отключённый tutorial flow.

Готово, когда чистый герой входит в клиент, видит HUD и локацию после cold start
и повторного входа без bootstrap `203/204`.

### 2. Character и inventory

Перенос:

- полные player stats, skills, HP/MP/EXP и regeneration;
- starter inventory и catalog fields;
- bag/pocket/magic/paperdoll;
- PUT_ON, PUT_OFF, DROP, stacks, capacity и stat recalculation;
- подтверждённые USE pipelines, нужные циклу 1–8.

Текущий срез: paperdoll `PUT_ON`/`PUT_OFF` для перчатки 9095 есть в runtime и
raw-AMF E2E. Inventory остаётся **частично** до реального CEF-прогона. DROP,
stack/capacity, durability и USE — следующий inventory capability.

Готово, когда мутации совпадают в текущем UI и после reconnect.

### 3. World, hunt и realtime

Перенос:

- areas, links, COME_IN/exit и travel time;
- authored hunt spawns, movement/respawn и busy locks;
- presence и esrv personal/area channels;
- необходимый квестам store subset.

Готово, когда два изолированных героя видят согласованные переходы, roster,
hunt busy и освобождение locks после restart.

### 4. Combat

Перенос:

- fight configuration, fproxy auth/poll и L/C/R;
- pocket, glove, rage/aggro и обязательный packet ordering;
- finish, loot, HP/EXP/level settlement и esrv exit;
- reconnect и fight locks;
- 72-hour finished history без persistence active state.

Invented/empirical формулы старого runtime переносятся как `legacy behavior`, а
не как live parity.

Готово, когда полный hunt fight завершается в клиенте без зависания, а
persistent результат переживает reconnect.

### 5. Quests и NPC 1–8

Перенос:

- NPC board/dialog/book;
- curated chain, goals, scripts и AREA waiting;
- quest fights, item flow, rewards и markers;
- system messages и минимальные reputation/store dependencies.

Готово, когда новый герой проходит утверждённую цепочку 1–8 без ручного патча
БД.

### 6. После core

Chat/party, полный store, mail, auction и trade рассматриваются отдельными
срезами только после завершения цикла 1–8.

### 7. Отложено

Professions, dungeons, battlegrounds, achievements, daily quests, heroism,
gear spells, info pages и content editor не входят в первую волну.

Clan и встроенные playerbots не переносятся.

## Acceptance gates

Каждый capability проходит:

1. **Scope:** относится к текущему срезу и не приносит deferred/playerbot/clan
   код.
2. **Behavior:** повторяет рабочий end-to-end сценарий `jgr-emu`, кроме явно
   задокументированного исправления.
3. **Wire:** URL, DTO, flat shapes, status/error и packet ordering покрыты
   raw-AMF E2E.
4. **Persistence:** player state находится в PostgreSQL; active combat — только
   в RAM; content — только из active release.
5. **Fail-fast:** отсутствующие данные и зависимости дают диагностируемую
   ошибку, а не fallback.
6. **Restart/concurrency:** проверяются там, где состояние или блокировка должны
   переживать запрос/процесс.
7. **Client:** основной сценарий проходит в реальном Flash/CEF-клиенте.
8. **Quality:** format, lint, dead-code, architecture, build и релевантные тесты
   зелёные.
9. **Docs:** обновлены модульный контракт и `docs/CAPABILITIES.md`; будущая
   возможность не объявлена реализованной.

## Готовность core

Core готов, когда чистая БД разворачивается одной процедурой, публикует полный
контент среза, а новый герой проходит цикл 1–8 в клиенте без обращения runtime к
`jgr-emu`, `_research` или старым fixtures.
