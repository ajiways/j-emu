# Клиентские команды

## Назначение

Этот документ задаёт практическую структуру OA, fproxy и esrv в `jugger-wire`.
Wire-контракт старого клиента не унифицируется: URL, AMF shape, flat responses,
`sq`, status/error и порядок MULTI frames сохраняются точно.

## Pipeline

```text
raw HTTP/TCP bytes
  → AMF codec / framing
  → transport envelope decoder
  → static registry lookup
  → exact command decoder
  → exact request DTO
  → small command handler
  → application port
  → exact response DTO
  → command encoder
  → raw AMF bytes
```

На каждом переходе существует один владелец validation. Codec проверяет AMF,
command decoder — wire shape, application service — бизнес-инварианты. Handler не
угадывает отсутствующие значения и не подставляет defaults.

## Descriptor команды

Descriptor статичен и связывает ключ, decoder, handler и encoder:

```ts
interface ClientCommandDescriptor<TContext, TRequest, TResponse> {
  readonly key: string;
  decode(value: unknown): TRequest;
  handle(context: TContext, request: TRequest): Promise<TResponse>;
  encode(response: TResponse): unknown;
}
```

В реальном коде низкоуровневые `unknown`/`AmfValue` остаются внутри wire decoder
и encoder. Handler видит только `TRequest/TResponse`. Descriptor может быть
разделён на небольшие файлы, если codec mapping перестаёт быть когезионным.

## OA

Transport decoder извлекает только общий envelope: `object`, `action`, `form`,
`in`, `sq`. Затем строится статический ключ:

- обычная команда: `object|action`;
- мультиплексированная команда вроде `common|object`: после минимальной проверки
  discriminator используется полный ключ `common|object:ATTACK_BOT`.

У каждой команды собственные DTO. Например, `common|init` не делит request type с
`user|bag`, а `ATTACK_BOT` не получает универсальный `form`.

Response descriptor явно определяет один из вариантов:

- nested block под исходным `object|action` (`store|list` — `{status,types,artikuls}`);
- flat набор блоков для `init/init2`, `store|buy` и других подтверждённых мутаций;
- protocol error с точным `status` и `error` (store buy dump-proven **2** для
  пустой корзины / не-лавки / неизвестного лота / нехватки золота — не 203).

`sq` зеркалирует transport, а не application handler. Неизвестный registry key
возвращает `status:203`; ошибка сессии — `status:4`; внутренняя ошибка логируется
с correlation id и кодируется как `status:204`.

## fproxy

fproxy registry использует проверенный discriminator (`rc` или framing-состояние)
и отдельные descriptors как минимум для:

- auth;
- poll;
- castSpell.

`castSpell` дополнительно декодируется в точный variant по `srcType/srcId`, когда
wire-команды имеют разные обязательные поля. Нельзя передавать raw map в combat.
Handler переводит DTO в transport-neutral combat command. Combat events
преобразуются в точные fproxy response DTO до AMF encoding.

HTTP и TCP могут разделять command descriptors, только если их подтверждённый
payload одинаков. Framing и состояние соединения остаются в transport adapter.

## esrv

esrv — long-poll transport, а не доменный API. Request DTO фиксирует session,
канал и подтверждённые cursor/ctime поля. Registry outbound events связывает
типизированное domain/application notification с точным packet DTO:

```text
notification type → static esrv encoder → channel packet DTO → MULTI frame
```

Выбор канала (`2:<account>`, party и другие подтверждённые каналы) выполняет
явная policy. Process memory допустима только для restart-safe ephemeral ожидания
соединения. Доставляемое событие, cursor и состояние gameplay не могут
существовать только в памяти процесса.

Пустой poll — валидный transport result после установленного timeout. Он не
является успешным ответом на неизвестную команду и не маскирует storage failure.

## Registry и startup

Три registry (`oa`, `fproxy`, `esrv`) создаются module factory из явных imports.
Factory получает готовые application ports и возвращает immutable registry.

Обязательные startup checks:

1. нет duplicate keys;
2. каждый descriptor имеет decoder, handler и encoder;
3. все обязательные dependencies переданы;
4. список реализованных keys можно получить для diagnostics/tests;
5. после startup registry не изменяется.

Dynamic import, filesystem scan и lazy handler construction запрещены.

## Регистрация routes

Fastify registration разделяется на независимые adapters:

- auth (`soc_auth.php`, cookie/redirect quirks);
- OA (`entry_point.php`);
- esrv long-poll;
- HTTP/TCP fproxy;
- static `Pub1`;
- game-page/CEF bootstrap.

Один adapter не регистрирует соседние группы и не содержит их parsers. Общий
server factory только вызывает registration functions с явными dependencies.

## Размер и ответственность handler

Один handler обслуживает одну клиентскую команду. Нормальная последовательность:

1. map wire request в application command;
2. один вызов application port либо короткая явная orchestration;
3. map результата в wire response.

Если handler содержит SQL, Fastify API, raw AMF checks, загрузку config/content
или ветвление по другим command keys, граница нарушена. Большой общий mapper
следует делить по DTO families, а не превращать в новый router.

## Ошибки

Decoder и application layer возвращают типизированные причины; только
`jugger-wire` выбирает legacy status/shape. Текст `error` не строится из stack
trace. Unknown command, malformed request, no session и internal failure —
различные случаи и имеют отдельные E2E.

Никакой boundary не преобразует ошибку в пустой `status:100`, пустой object или
исторический fallback.

## Definition of done команды

Команда считается добавленной, когда:

- её raw request/response подтверждены fixture/исследованием;
- существуют точные request/response DTO и explicit mapper;
- descriptor статически зарегистрирован;
- transport остаётся без бизнес-логики;
- raw-AMF E2E проходит через Fastify и изолированный PostgreSQL;
- malformed, no-session и unsupported paths проверены;
- application/domain не импортируют `AmfValue`.
