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
3. Scope не включает соседнюю capability, `deferred` (нужен явный queue-edit)
   или excluded behavior.
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

1. Работать напрямую в `main`, если это не тот редкий случай, где нужна
   отдельная ветка (см. `AGENTS.md` § Git workflow). Ветка
   `cap/<id-lowercase>-<short-name>` — опция для риска/параллельной работы, не
   обязательный шаг.
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

Проверки коллекций на shared или растущих area/каталогах пишутся через
contains (`expect.arrayContaining`, `toContain`), не через равенство полного
списка, если зона не изолирована под конкретный тест. Точное `toEqual` по
длине или составу ломается, когда соседняя capability добавляет hotspot
или каталожную строку в ту же локацию.

### 8. CEF acceptance

1. Применить migrations и опубликовать development content штатными командами.
   Если `db:migrate` отказывает из-за `was modified` / missing journal —
   `npm run db:reset`, не править применённый SQL.
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

Исключение допустимо только для явно помеченной в roadmap `internal enabling
capability`, у которой ещё нет production wire consumer. Для неё запрещено
добавлять test/dev OA ради CEF; application port проверяется integration-тестом,
а persisted result — существующим read path через raw-AMF, reconnect и restart.
Такой implementation item может получить workflow-статус `done`, но product
status остаётся `partial`. Первый production consumer наследует обязательные
raw-AMF и CEF acceptance этого поведения.

### Отложенный CEF до content editor (Wave 5–12) — закрыто

Закрыто close EDT-02: рабочий operator HTTP `/operator/content/*` есть.
Не применять это исключение к новым capability. Исторически на Wave 5–12
действовало:

Ручной CEF-прогон без content editor требует патчить БД под каждый сценарий —
дорого и хрупко. На срез до `EDT-01`/`EDT-02` (Wave 13) действовало отдельное,
явно объявленное исключение — не то же самое, что «нет production consumer»
из раздела выше:

- любая capability Wave 5–12 могла получить workflow `done` / product
  `partial` при зелёных gates §7 и полном raw-AMF E2E **без** CEF, даже если
  у неё есть production wire consumer;
- каждая такая capability обязана оставить в `docs/migration/CEF_MANUAL.md`
  свою строку (сценарий, герой/контент, что кликнуть) — backlog остаётся;
- `CAPABILITIES.md` для такой capability пишет «CEF не прогонялся» явно;
- исключение закрыто целиком close EDT-02. С этого момента раздел
  «Настоящие развилки» и правило «production consumer уже есть → CEF —
  следующий шаг той же capability» снова действуют без исключений.
  Отдельный проход по `CEF_MANUAL.md` в порядке волн (Wave 0 → Wave 12)
  не является записью `ROADMAP.md` и не сдвигает `next`;
- находка на этом проходе, расходящаяся с raw-AMF E2E, переоткрывает именно
  ту capability (снимает `done`/`partial` до факта), а не патчится точечно
  мимо её acceptance.

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
- scope выходит в `deferred`, excluded, clan или in-process playerbots;
- unrelated dirty files невозможно надёжно отделить от capability diff.

Replan изменяет roadmap/checkpoint/ADR до возобновления coding. Ошибка gate с
понятной локальной причиной исправляется в текущей capability и сама по себе не
требует replan.

## Автопилот — продолжать очередь без внешнего решения на каждом шаге

Цель: любой agent-запуск берёт этот файл и `ROADMAP.md` и проходит сколько
угодно capability подряд, останавливаясь только на настоящей развилке — не
после каждой отдельной capability за подтверждением. Один запуск — это просто
повторение цикла ниже, не отдельная договорённость под каждую capability.

### Цикл одной итерации

1. **Guard.** Рабочее дерево чистое, текущая ветка — `main` (или явно
   оговорённая, см. `AGENTS.md` § Git workflow). В `ROADMAP.md` ровно одна
   запись `next`, и все её `depends_on` — `done`. Если не так — это не задача
   автопилота: сломанную очередь не чинят молчаливым выбором записи по вкусу,
   останавливаются и сообщают.
2. Пройти цикл «1. Выбор» → «9. Закрытие» выше **целиком**, без пропуска шага
   ради скорости.
3. **Gate-решение о статусе** — определяется правилами ниже, не запросом:
   - все gates §7 зелёные и CEF прогнан по acceptance → workflow `done`,
     product `done`;
   - gates зелёные, CEF не прогнан **и** у capability по формулировке
     `ROADMAP.md` нет production wire consumer (исключение §8) → workflow
     `done`, product `partial`, в `CAPABILITIES.md` — явно «нет production
     consumer», не тихое умолчание;
   - историческое исключение Wave 5–12 («Отложенный CEF до content editor»)
     закрыто close EDT-02; не применять к новым capability;
   - gates зелёные, CEF не прогнан, но исключение §8 (нет production
     consumer) не применяется → capability остаётся открытой, CEF — это
     следующий шаг **той же** capability, а не сдвиг очереди дальше;
   - любой gate красный или сработал любой пункт «Stop and replan» → цикл
     прерывается, capability не закрывается, `next` не двигается, doc-статус
     не трогается.
4. **Commit не запрашивается.** Он обязателен сразу после прохождения
   закрытия (шаг 9 выше и `AGENTS.md` § Git workflow) — «нужен ли коммит»
   не вопрос, на который ждут ответа.
5. Ровно одна следующая dependency-ready запись (первая по порядку документа,
   у которой все `depends_on` теперь `done`) получает `next`. Если таких
   несколько — это тоже развилка очереди, не выбор агента: остановиться и
   зафиксировать конфликт, не проставлять `next` наугад.
6. Вернуться к шагу 1 для новой `next`-записи. Продолжать без вопроса
   до пункта «Настоящие развилки» ниже или до конца очереди.

### Настоящие развилки — только они останавливают цикл

Всё из «Stop and replan» выше плюс:

- CEF обязателен для этой capability, но технически недоступен (нет
  CEF/Flash-стенда в этом запуске) — capability виснет на этом шаге, не
  закрывается «по-тихому» через exception §8. Историческое исключение
  Wave 5–12 закрыто close EDT-02;
- generate/migration/content-publication ломается по причине, не описанной в
  существующих docs (пример: `drizzle-kit generate` не умеет сериализовать
  BigInt default) — чинится причина в schema/коде, ручной ALTER/SQL поверх
  не пишется; если неясно, чинить ли схему или это архитектурная граница —
  это `ARC-*`, не самостоятельное решение агента;
- в очереди одновременно 0 или >1 записи `next` — сама очередь сломана, это
  не то, что автопилот исправляет молча.

### Разовый запуск

Достаточно одной строки без capability-специфичных деталей — они уже в
`ROADMAP.md`/`CAPABILITIES.md`:

> Следуй `docs/migration/PLAYBOOK.md` § «Автопилот». Продолжай очередь
> `ROADMAP.md`, пока не сработает «Stop and replan»/настоящая развилка или
> очередь не закончится.
