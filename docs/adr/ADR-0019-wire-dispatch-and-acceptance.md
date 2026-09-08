# ADR-0019: Wire dispatch и приёмка поведения

- Статус: Accepted
- Дата: 2026-09-08
- Заменяет: ADR-0007, ADR-0012, ADR-0014

## Решение

Wire сохраняет старые URL, AMF shapes, flat blocks, status/error semantics и
packet ordering. `AmfValue` разрешён только в codec/framing и низкоуровневом
decoder/encoder.

Каждая OA/fproxy/esrv команда имеет:

- точный request/response DTO;
- decoder/encoder;
- небольшой handler через public application ports;
- явную static registration.

Dynamic imports, directory scanning, mutable registries и universal DTO с
optional business fields запрещены. Transport выполняет только
decode → registry → typed handler → encode.

Основной acceptance test — короткий E2E через production module factories,
реальный Fastify route, raw AMF и отдельный PostgreSQL `_test`. Unit tests
остаются для codecs, formulas и сложных state machines; integration tests — для
transactions, locking, migrations и content publication.

Рабочий client scenario `jgr-emu` является baseline переноса. Новый research
нужен только при конфликте evidence, неизвестном wire, регрессе или старой
пометке stub/bug. Статус **готово** требует проверки в реальном Flash/CEF.

## Канонические детали

- [WIRE_INVARIANTS.md](../migration/WIRE_INVARIANTS.md)
- [CLIENT_COMMANDS.md](../architecture/CLIENT_COMMANDS.md)
- [TESTING.md](../TESTING.md)
- [SOURCE_BOUNDARY.md](../migration/SOURCE_BOUNDARY.md)

## Последствия

- Command coverage виден в registry и E2E, а не восстанавливается из логов.
- Request-by-request debugging остаётся диагностикой, но не стратегией переноса.
- Stub success не считается совместимостью; unknown operation получает
  документированный отказ.
