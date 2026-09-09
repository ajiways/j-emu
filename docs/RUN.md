# Запуск

## Окружение

`.env` читается из каталога `package.json`, не из `cwd` и не из `dist/`. Обязательные переменные перечислены в `.env.example`; defaults нет.

Перед первым клиентским запуском:

```text
npm run db:migrate
npm run db:publish:development
```

`db:migrate` накатывает схему. `db:publish:development` публикует `content/playable-slice.json`. Без обоих шагов runtime не стартует с пустой БД.

Если `db:migrate` падает с `was modified` / missing journal, SQL миграций не
правят. Development база из `DATABASE_URL` пересоздаётся целиком:

```text
npm run db:reset
```

`db:reset` делает `DROP DATABASE` + `CREATE DATABASE` для имени в `DATABASE_URL`,
затем migrate и publish. Это уничтожает героев и активный release. Команда
отказывается трогать БД с суффиксом `_test` и URL, равный `TEST_DATABASE_URL`.
Тестовая БД сбрасывается только `npm run test:integration` / `test:e2e`.

Тот же publish-скрипт на уже заполненной БД: совпавший checksum — no-op;
новый checksum — новая активная release. Смена checksum витрины (например,
только type `-131`) требует повторный `npm run db:publish:development`.
До baseline ledger — `0000_foundation_init` плюс последующие generated
`0001_inventory_item_upgrade`, `0002_inventory_item_tempeffect`,
`0003_inventory_item_expire_use` и `0004_content_draft_use_types`;
несовпавший ledger — `db:reset`, не правка SQL.

## HTTP :8080 (браузер без CEF)

`.env`:

```text
HOST=0.0.0.0
PORT=8080
HTTP_ONLY=1
```

```text
npm run dev
```

или `npm run build` и `npm start`. Открыть `http://localhost:8080/login`.

## HTTPS :443 (Flash/CEF)

Клиент `juggernautclient.exe` ходит на `https://s1.jugger.ru:443`. Нужны hosts, доверенный сертификат и сервер с legacy TLS.

`.env`:

```text
HOST=0.0.0.0
PORT=443
HTTP_ONLY=0
CERTS_DIR=./certs
PUB1_DIR=../Pub1
```

В `CERTS_DIR` обязаны лежать `cert.pem` и `key.pem` (CN=`s1.jugger.ru`). Отсутствие файлов завершает startup ошибкой. Порт 443 на Windows обычно требует запуска от администратора.

```text
npm run db:migrate
npm run db:publish:development
npm run start:https
```

`start:https` проверяет `HTTP_ONLY=0`, `HOST=0.0.0.0`, `PORT=443` и наличие сертификатов, затем слушает `:443` с `minVersion=TLSv1`, `ciphers=ALL:@SECLEVEL=0`, `honorCipherOrder` и `SSL_OP_LEGACY_SERVER_CONNECT`. Тот же процесс слушает TCP `FIGHT_PROXY_PORT` (по умолчанию `33120`) для Flash policy-file и fight Socket. `FIGHT_PROXY_PATH` в `.env` — это wire-поле `fight|conf.proxy`, live-значение `https://s1.jugger.ru/fproxy//;`, не относительный `/fproxy/`.

### Hosts

`C:\Windows\System32\drivers\etc\hosts` (от администратора), IP — адрес машины, где слушает эмулятор:

```text
<emu-ip>  s1.jugger.ru
<emu-ip>  s1.jugger.vkplay.ru
<emu-ip>  static.jugger.ru
```

`static.jugger.ru` нужен updater CEF (манифест `Build1.lst`), не игровому OA.

### Доверенный корень

`certs/cert.pem` — самоподписанный. CEF не соединится, пока сертификат не в доверенных корневых.

1. Скопировать `cert.pem` на клиентскую ОС (можно как `cert.crt`).
2. Установить сертификат для локального компьютера.
3. Хранилище: доверенные корневые центры сертификации.

Проверка в браузере: `https://s1.jugger.ru/login` без предупреждения о сертификате. Затем CEF: `https://s1.jugger.ru:443`.

Старый walkthrough с VM/hosts: [`jgr-emu/docs/REDIRECT.md`](../../jgr-emu/docs/REDIRECT.md). Путь сертификата в `j-emu` — `certs/`, не `server/certs/`.

## Статика

Клиентский shell запрашивает файлы с корня origin (`/js/**`, `/images/swf/main.swf`, далее `/amf/**` и прочие пути Pub1). `PUB1_DIR` монтируется как `/`, не как `/Pub1/`.

## OA access log

Каждый `POST /entry_point.php` пишет pino-событие `msg=oa` с объектом `oa`:

```text
accountId, object, action, commandKey, sq, outcome, status, topLevelKeys
```

`outcome`: `ok` | `unsupported` | `decode_failure` | `protocol_error` | `internal_error`.
На ошибке добавляется `error` (тот же текст, что уходит в wire). Сырое AMF-тело,
`form`/`in`, cookies, пароли и session secrets в этот лог не попадают.

`LOG_LEVEL=info` (см. `.env.example`). Поиск по запуску:

```text
jq 'select(.msg=="oa") | .oa' logs
```

или в stdout процесса `npm run start` / `npm run start:https`.
