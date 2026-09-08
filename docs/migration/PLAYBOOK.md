# Capability migration playbook

Этот документ задаёт повторяемый процесс исполнения
[очереди capabilities](ROADMAP.md). Продуктовый статус хранится только в
[CAPABILITIES.md](../CAPABILITIES.md); evidence и контракт — в
[EVIDENCE_INDEX.md](EVIDENCE_INDEX.md) и соответствующем `docs/modules/*`.
Известные точки глобального пересмотра ownership/data flow перечислены в
[ARCHITECTURE_EVOLUTION.md](ARCHITECTURE_EVOLUTION.md).

## Роли

### Architecture agent

Architecture agent не пишет production code, tests, migrations или package
configuration. Он:

- проверяет зависимости и scope следующей capability;
- читает полный legacy flow и более сильное evidence;
- обновляет roadmap, модульный контракт и архитектурные документы;
- фиксирует architecture checkpoint как «текущих ADR достаточно», новый ADR
  или блокирующий `ARC-*`;
- создаёт ADR только для долгоживущего решения с реальными альтернативами;
- после реализации проводит boundary/contract audit и подтверждает, что
  документация не выдаёт будущую функцию за готовую.

Architecture agent не проектирует private classes за coding agent и не
расширяет capability скрытым рефакторингом.

### Coding agent

Coding agent реализует одну подготовленную capability:

- следует заполненному checkpoint и модульному контракту;
- переносит vertical path через public ports, typed DTO, static registry,
  Drizzle и active content release;
- добавляет raw-AMF E2E и только необходимые unit/integration tests;
- проверяет persistence, concurrency, restart и CEF по acceptance;
- возвращает architecture agent проверяемый отчёт: commits/diff, schema/content
  changes, tests, index status и наблюдаемый CEF outcome.

Если контракт или checkpoint не позволяет однозначно реализовать capability,
coding agent останавливается и возвращает вопрос architecture agent, а не
изобретает fallback или новую границу.

## Цикл одной capability

### 1. Выбор

1. В `ROADMAP.md` должна быть ровно одна запись `next`.
2. Все её `depends_on` имеют статус `done`.
3. Scope не включает соседнюю capability, post-core или excluded behavior.
4. Рабочее дерево проверяется до изменений; чужие dirty-файлы записываются и
   не форматируются, не stage-ятся и не включаются в commit.

### 2. Evidence

1. Начать с `EVIDENCE_INDEX.md`, `SOURCE_BOUNDARY.md`, legacy
   `CAPABILITIES.md` и тематического legacy-документа.
2. Прочитать old flow целиком: route/command, application/domain rules,
   persistence, wire mapper, tests/dumps и content inputs.
3. Использовать codebase index graph первым для структуры и call paths;
   проверить status/coverage и дочитать непокрытые диапазоны обычным поиском.
4. Повторный request-by-request research делать только при конфликте evidence,
   неизвестном wire, регрессе или legacy-пометке stub/bug.
5. Неразрешённый конфликт записать явно; не выбирать удобный источник молча.

### 3. Architecture checkpoint

До coding architecture agent обновляет запись capability:

- подтверждает владельцев persistent state и authored content;
- перечисляет public ports и transaction boundary;
- фиксирует wire DTO/ordering и fail-fast errors;
- определяет clock/RNG/ID/lock ownership, если применимо;
- решает, покрывают ли изменение ADR-0017–ADR-0020;
- задаёт restart/concurrency и CEF acceptance.

Результат checkpoint — один из четырёх:

1. действующие решения достаточны;
2. сначала нужен новый ADR;
3. сначала нужен блокирующий `ARC-*`;
4. зависимости или порядок очереди неверны — replan.

### 4. Контракт и content

1. Обновить соответствующий `docs/modules/*` без product-status заявлений.
2. Перечислить точный content set и provenance.
3. Добавить typed importer/validation в implementation capability; одна
   невалидная ссылка отклоняет весь candidate release.
4. Runtime читает только PostgreSQL active projection и не дочитывает fixtures,
   `jgr-emu` или `_research`.

### 5. Реализация

1. Создать ветку `cap/<id-lowercase>-<short-name>` от согласованной базы, если
   capability ещё не находится в собственной изолированной ветке.
2. Сначала добавить или уточнить vertical raw-AMF acceptance scenario.
3. Реализовать минимальный полный path: decode → typed command → application
   ports → transaction/content → exact response/realtime mapping.
4. Не импортировать framework code в domain/application и не обращаться к
   таблицам другого модуля мимо public application ports.
5. Missing dependency/content/handler завершается диагностируемым `203`/`204`,
   а не default, fixture fallback или пустым `100`.
6. Делать локальные commits по завершённым когезионным результатам; перед
   каждым commit проверять `git status`/diff и stage-ить только capability.
   Hooks не обходить.

### 6. Индекс

Перед структурным поиском:

1. проверить `list_projects` и `index_status`;
2. при отсутствии проекта выполнить full persistent indexing;
3. использовать architecture/search graph, exact snippet и call tracing;
4. перед отрицательным выводом проверить index coverage и filesystem evidence.

После существенных изменений:

1. выполнить change detection;
2. обновить индекс `j-emu` в full persistent mode;
3. повторить boundary/impact query на изменённом path.

Заведомо устаревший индекс блокирует передачу capability.

### 7. Gates

Во время реализации запускать минимальные релевантные suites. Перед CEF:

```text
npm run format:check
npm run lint
npm run dead-code
npm run check:architecture
npm run build
npm run test:unit
npm run test:integration
npm run test:e2e
```

DB suites используют только отдельный `TEST_DATABASE_URL` с суффиксом `_test`.
Нельзя пропускать suite, подставлять fake URL или считать memory test
проверкой persistence. `npm run check` можно использовать для quality/build
части, но он не заменяет `npm run test:all`.

### 8. CEF acceptance

1. Применить migrations и опубликовать development content штатными командами.
2. Запустить HTTPS `s1.jugger.ru:443` через `npm run start:https` с
   доверенным сертификатом и правильными hosts/Pub1 paths.
3. Использовать нового героя/чистый сценарий, не существующий dev-прогресс и не
   ручной patch БД.
4. Выполнить один пользовательский flow из acceptance capability, включая
   reconnect/restart checkpoint, если он указан.
5. Зафиксировать наблюдаемый outcome и отсутствие `203/204`, timeout или UI
   рассинхронизации на поддерживаемом пути.

CEF не заменяет raw-AMF assertions, а raw-AMF E2E не заменяет CEF для статуса
«готово».

### 9. Закрытие

1. Architecture agent сверяет boundary, ADR/checkpoint и отсутствие
   незапланированного scope.
2. Architecture agent обновляет модульный контракт, `CONTENT_MATRIX.md` при
   изменении content и `CAPABILITIES.md` коротким доказанным product-status
   фактом.
3. Текущая capability получает `done`; ровно одна следующая dependency-ready
   запись получает `next`.
4. Проверить ссылки и удалить временную дублирующую backlog-прозу.
5. Commit не включает чужие изменения; push/PR выполняются только когда задача
   явно требует внешней публикации.

## Правило `ARC-*`

`ARC-*` — отдельная блокирующая запись очереди для необходимого архитектурного
рефакторинга, а не метка удобной уборки.

Создать `ARC-*` можно только если во время checkpoint или реализации найдено
одно из следующего:

- текущая module boundary делает capability циклической или нарушает public
  ports;
- transaction/ownership model не может обеспечить acceptance;
- действующий ADR не покрывает новое долгоживущее решение;
- без изменения общей инфраструктуры невозможно exact wire, fail-fast,
  persistence или concurrency behavior.

Для `ARC-*` обязательны `depends_on`, затронутые capabilities, evidence,
решение/ADR, собственная acceptance и статус. `ARC-*` вставляется перед первой
заблокированной capability; её статус остаётся `queued`, а текущая работа
останавливается.

Нельзя:

- прятать архитектурный refactor внутри feature diff;
- создавать `ARC-*` ради naming, cleanup или предположительного reuse;
- продолжать capability параллельно с нерешённым blocking `ARC-*`;
- повышать product status после одного refactor без клиентского behavior.

## Stop and replan

Работа останавливается и возвращается на architecture checkpoint, если:

- evidence конфликтует или legacy behavior оказалось stub/known bug;
- нужен отсутствующий обязательный content/reference/command;
- acceptance требует capability, которой нет в `depends_on`;
- появляется новая cross-module write, transaction, persistent owner или
  process-lifetime state;
- exact wire shape/order неизвестен;
- CEF расходится с raw-AMF E2E;
- migration/publication не атомарна или restart/concurrency теряет state;
- реализация требует fallback, dynamic registry/import, runtime fixture read
  или изменения active-combat persistence;
- scope выходит в post-core, deferred, clan или in-process playerbots;
- unrelated dirty files невозможно надёжно отделить от capability diff.

Replan изменяет roadmap/checkpoint/ADR до возобновления coding. Ошибка gate с
понятной локальной причиной исправляется в текущей capability и сама по себе не
требует replan.
