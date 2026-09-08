# ADR-0014: Типизированный статический dispatch клиентских команд

- Статус: Superseded by [ADR-0019](ADR-0019-wire-dispatch-and-acceptance.md)
- Дата: 2026-09-07

## Контекст

Legacy transport принимает неоднородные OA, fproxy и esrv payloads. Универсальный
`Record<string, AmfValue>` удобен в codec, но переносит непроверенные значения
глубоко в application-код. Большой router с ветвлением по строковым ключам
смешивает decode, validation, orchestration и wire mapping. Динамическая загрузка
handlers усложняет startup failure, типизацию, анализ зависимостей и тесты.

Wire остаётся неоднородным намеренно: разные команды имеют разные обязательные
поля и разные response shapes. Общий DTO с optional-полями эту разницу скрывает.

## Решение

### Граница `AmfValue`

`AmfValue` разрешён только в:

- AMF codec;
- SINGLE/MULTI framing;
- низкоуровневом decoder, который проверяет неизвестное значение и строит точный
  request DTO;
- низкоуровневом encoder, который преобразует точный response DTO в AMF.

Application ports, handlers, domain и repositories не принимают и не возвращают
`AmfValue`, `Record<string, AmfValue>` или непроверенный `unknown`.

### Точные DTO

Каждая поддержанная клиентская команда имеет отдельную пару типов:

- OA: request/response для точного ключа `object|action` либо для конкретного
  `code`, если он образует самостоятельную команду;
- fproxy: request/response для `auth`, `poll`, `castSpell` и последующих команд;
- esrv: request и точный набор outbound packet DTO для конкретного канала/события.

DTO отражает wire, включая исторические имена, `status`, `error`, flat blocks и
различия между отсутствующим полем и пустым значением. Доменный command является
другим типом; mapper явно переводит wire DTO в application command и обратно.

Decoder обязан отклонить отсутствующее, лишнее критичное или неверно
типизированное поле документированным protocol error. Handler не повторяет
структурную validation.

### Статический registry

Registry создаётся синхронно из явных imports:

```ts
const oaCommands = {
  "common|init": commonInitCommand,
  "common|init2": commonInit2Command,
  "common|object:ATTACK_BOT": attackBotCommand,
} satisfies StaticCommandRegistry;
```

Аналогичные registry используются для fproxy и esrv. Ключ регистрируется ровно
один раз; duplicate key и отсутствующая dependency являются startup error.

Запрещены `import()`, `await import()`, сканирование директорий, naming convention
discovery и mutation registry после startup. Unknown command не пытается найти
модуль во время запроса и возвращает документированный `status:203`/transport
error.

### Тонкий transport, маленький handler

Transport отвечает только за URL, raw body/cookie, decode, registry lookup,
correlation/logging и encode. Command handler:

1. получает уже валидный request DTO и явные application ports;
2. выполняет одну небольшую orchestration;
3. возвращает точный response DTO либо типизированную ошибку.

Handler не регистрирует Fastify routes, не читает env/files, не создаёт
repositories, не декодирует AMF и не содержит unrelated commands. Общие части
выносятся в явные mappers/policies, но не в универсальный handler с optional
payload.

## Размещение

Рекомендуемая форма:

```text
jugger-wire/
  amf/                         # codec и framing
  commands/
    oa/common/init.ts          # DTO, decoder/encoder, handler descriptor
    oa/common/attack-bot.ts
    fproxy/auth.ts
    fproxy/cast-spell.ts
    esrv/poll.ts
  registry/
    oa-command-registry.ts
    fproxy-command-registry.ts
    esrv-command-registry.ts
  transport/http/
  transport/tcp/
```

Когезионная DTO-family одной команды может находиться в одном файле. Публичный
application port доменного модуля остаётся вне `jugger-wire`.

## Проверки

- TypeScript гарантирует соответствие descriptor его request/response DTO.
- Registry test проверяет уникальность и полный ожидаемый список ключей.
- Decoder tests покрывают malformed payloads.
- Raw-AMF E2E проверяет route → handler → PostgreSQL → response.
- CI запрещает `AmfValue` вне разрешённых каталогов и dynamic import в production.

## Последствия

- Добавление команды требует явного файла и регистрации, зато startup и call graph
  детерминированы.
- Появится больше небольших DTO, но wire-расхождения станут compile-time или
  boundary errors.
- `ObjectActionRouter` и универсальный parsing внутри HTTP adapter являются
  переходным кодом и подлежат замене, а не расширению.
