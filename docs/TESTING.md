# Тестирование

## Основное правило

Поведение клиента проверяется E2E-first: реальные Fastify routes, raw AMF и
изолированный PostgreSQL. Подробное решение — в
[`ADR-0019`](adr/ADR-0019-wire-dispatch-and-acceptance.md).

Тестовые уровни не обозначают каталоги ради каталогов. У каждого уровня узкая
задача:

- **E2E:** OA, fproxy, esrv и пользовательские сценарии целиком;
- **unit:** codecs/framing, детерминированные формулы, сложные state machines;
- **integration:** Drizzle transactions/locking, migrations, content publication.

Простые application/repository tests с mocks не добавляются.

## Основные E2E suites

Текущий playable slice покрыт независимыми файлами в `tests/e2e/`:

- `character-bootstrap` — полный flat init/init2 inventory, skills, HUD
  HP/MP/EXP, welcome `{nick}`, reconnect/restart character state;
- `inventory-equipment` — raw-AMF `PUT_ON`/`PUT_OFF` glove 9095, paperdoll
  slot/view/stats, same instance back to bag, restart, `203`/`204`;
- `personal-details` — `user|save_personal_details` flat `status:100` + `state`,
  persist `pondViewLast` после restart, overlay tutorial flags, nested getter;
- `browser-auth` — HTML login/register, 302 handoff, пять cookies только в 200,
  cookie restore, FlashVars/`main.swf`, Pub1 root static, duplicate conflict;
- `https-startup` — Fastify listen с legacy TLS и GET `/login`;
- `unsupported` — `clan|info` → `status:203`;
- `hunt-attack` — `ATTACK_BOT` → flat `fight|conf` с decimal `fightId`/`userId`
  и `instance_id:"0"`;
- `fproxy` — auth / poll / `castSpell` до `fightFinish`; `oppnew.id` ≥ 1000000;
- `esrv-exit-reconnect` — `fight|exit`, затем restart и повторный hunt;
- `combat-restart` — restart посреди боя прекращает active fight, не меняет
  HP/bag и не создаёт finished history;
- `finished-fights` — после terminal hunt в PostgreSQL ровно одна строка с
  numeric `teams.1[].id`; повторная идентичная запись не дублирует;
- `concurrent-heroes` — два уникальных slot параллельно, разные hero/fight id;
- `protocol-errors` — no-session `status:4`, Flash Content-Type → не `415`,
  malformed `204`, unknown OA/fproxy `203`;
- `bootstrap-oa-trace` — CEF-order probe: весь burst init→jail status 100;
- `common-conf` — `common|conf` status 100 + live `gag_reason_info` + `state`;
- `user-unitframe` — `user|unitframe` status 100 + live HUD keys (`hpMax`, не `maxHp`) + `state`;
- `bootstrap-chrome` — jgr-emu shapes: view/magic/chat/flash/menu/book trio/empty lists;
- `location-area-conf` — `common|init2`: вложенный `area_conf` (`forestvillage.swf`,
  `radvei_map.swf`, пустые `items`/`client_data`) и массив `common|hunt`
  (`hunt_mask`, `position_x/y`, idle `fight_id` 0);

Content import → validate → publish и invalid candidate → rollback остаются
integration-тестами PostgreSQL, не Fastify E2E.

Suite расширяется вертикальными пользовательскими сценариями, а не отдельным
E2E на каждый getter.

## Обязательное окружение

`TEST_DATABASE_URL` указывает только на отдельную PostgreSQL database. Test
harness обязан отклонить URL без принятого test-маркера/allowlist и URL, равный
`DATABASE_URL`. Если переменная отсутствует или БД недоступна, тесты завершаются
ошибкой — memory fallback и silent skip запрещены.

Перед DB/E2E run:

1. PostgreSQL доступен;
2. test database создана;
3. все Drizzle migrations применяются с нуля;
4. fixture/content revision публикуется через штатный publication path
   (`content/playable-slice.json` → drafts → validate → activate);
5. каждый тест создаёт собственные account, hero и business IDs.

Нельзя использовать dev account, существующий прогресс или вручную
подготовленную строку в локальной БД.

## E2E harness

Harness строит приложение теми же module factories, что production, с отличиями
только в config, clock/RNG policy при необходимости и адресе БД. Он не импортирует
private handlers/repositories. Memory composition в harness отсутствует.

Fastify `inject` считается реальным route-level вызовом: проходят route
registration, content-type parser, cookies, error mapping и response encoding.
Payload передаётся как `Buffer` с raw AMF. Для MULTI тест работает с реальными
length-prefixed frames.

Минимальный шаблон сценария:

1. создать изолированные исходные данные через публичный setup API или DB fixture
   builder, предназначенный только для tests/support;
2. выполнить auth/game cookie flow;
3. отправить raw OA/fproxy/esrv request в Fastify;
4. проверить HTTP status, bytes/decoded exact shape и `sq`;
5. проверить persisted effect повторным клиентским запросом;
6. для критичного state — перезапустить application и проверить reconnect;
7. удалить только созданные тестом данные.

E2E не читает внутреннюю таблицу вместо проверки клиентского результата.
Дополнительный SQL assert разрешён для атомарности/отсутствия побочного эффекта.

## Изоляция и параллельность

Persisted ID создаёт PostgreSQL тем же способом, что production. Уникальность
тестового сценария задаётся отдельным operation key/login slug, но не ручным
entity ID. Фиксированные slot/id между тестами запрещены. Cleanup выполняется в
`finally/afterEach` и учитывает порядок владения данными. Предпочтительны
per-test namespace/operation key и идемпотентное удаление известных строк.

Тест не зависит от порядка suite, wall clock, реальной сети и sleep. Long-poll
управляется внедрённым clock/signal или коротким подтверждённым timeout. RNG
фиксируется seed/policy на границе module factory.

Если suite допускает параллельный запуск, два теста не должны разделять session,
hero, content draft/revision или sequence range.

## Unit

Unit-тесты допустимы для:

- AMF marker/reference/string/table codecs;
- SINGLE/MULTI framing и повреждённых frames;
- чистых deterministic calculations;
- сложных state machines, включая combat replay;
- чистого command decoder, когда нужен точный malformed corpus.

State machine получает fake clock/RNG/ID через constructor. Такие fakes живут в
`tests/support`, не в `src`. Unit не поднимает Fastify или PostgreSQL и не
утверждает wire parity пользовательского сценария.

## Integration

Integration-тест всегда использует PostgreSQL и реальный Drizzle adapter. Он
добавляется только для:

- commit/rollback и вложенного Unit of Work;
- optimistic/pessimistic locking, race и idempotency;
- migrations: clean install полной схемы, повторный migrate как no-op,
  checksum применённого SQL, identity/sequences по ADR-0018;
- content validation, staging, atomic publication и отказ без partial revision.
- finished fight history: idempotent insert, area/account query и bounded
  cleanup записей старше 72 часов.

CRUD repository без конкурентного/транзакционного инварианта покрывается E2E.

## Ошибки, которые обязательны к проверке

Для применимой команды проверяются:

- нет session → `status:4`;
- unknown/forbidden operation → `status:203` с `error`;
- malformed raw AMF → документированный protocol error;
- storage/internal failure → `status:204`, без пустого успеха;
- transaction failure не оставляет частичных изменений;
- duplicate request не удваивает эффект, если команда идемпотентна.

Не следует сравнивать весь крупный snapshot, если контрактом являются несколько
точных blocks. Однако flat/nested shape, отсутствие лишней вложенности и
различие missing/empty проверяются явно.

## Команды

```text
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:all
npm run build
npm run lint
```

`npm test` запускает только `test:unit` и не требует PostgreSQL. Полный набор —
`npm run test:all`; он падает без безопасного `TEST_DATABASE_URL`, а не пропускает
DB suite.

`test:integration` и `test:e2e` требуют `TEST_DATABASE_URL` на отдельную БД с
суффиксом `_test`. Скрипты сначала вызывают `reset-test-database.ts`, который
падает без URL. Сами suite падают через Vitest `setupFiles`
(`require-test-database-url.setup.ts`) до первого теста, если URL отсутствует,
имя без `_test` или совпадает с `DATABASE_URL`. Конфиги `vitest.db.config.ts` и
`vitest.e2e.config.ts` при импорте БД не требуют: `npm run dead-code` / Knip
анализируют проект без `TEST_DATABASE_URL` и без подключения к PostgreSQL.
Подставлять fake/default URL запрещено. `ApplicationHarness` строит production
composition и не имеет memory fallback.

Каждый E2E логинится через публичный `GET /soc_auth.php?slot=N` со случайным
слотом (`crypto.randomInt`). Фиксированный `slot=0` запрещён.

Разрешённый parallel mode для DB/E2E — последовательные файлы
(`fileParallelism: false`): один `TEST_DATABASE_URL`, migrate/publish на старте
harness. Внутри файла допустим `Promise.all` по разным session. `npm run test:all`
запускает unit → integration → e2e последовательно.

TCP fproxy (`FightTcpConnection`) проверяется unit-тестом: Fastify `inject` этот
транспорт не покрывает.

## Definition of done

Изменение клиентского поведения готово, когда:

- сначала добавлен/обновлён raw-AMF E2E;
- E2E работает через Fastify и изолированный PostgreSQL;
- при необходимости добавлен только узкий unit или integration test;
- тест устойчив к отдельному и параллельному запуску;
- нет skipped, forced exit, memory fallback и общего player-state;
- релевантные suites, build и lint проходят.
