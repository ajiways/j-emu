# ADR-0017: Границы runtime и fail-fast

- Статус: Accepted
- Дата: 2026-09-08
- Заменяет: ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0008, ADR-0009

## Решение

`j-emu` — один Fastify process и один PostgreSQL, разделённые на бизнес-модули.
Composition root создаёт process resources и соединяет module factories.

- Domain/application не импортируют Fastify, Drizzle или чужую
  infrastructure.
- Модуль публикует application ports и immutable DTO/events; чужие repositories
  и таблицы не являются API.
- Один application command владеет одной явной транзакцией. Network waits и
  transport writes выполняются вне неё.
- Read models могут читать несколько schemas, но не записываются как domain
  state.
- Durable asynchronous integration использует transactional outbox только при
  появлении реального consumer; event infrastructure не создаётся «на будущее».
- Stateful services — classes с constructor injection; codecs, mappers и
  deterministic calculations — pure functions.

Обязательные config/data/dependency не получают default или fallback.
Отсутствие handler/content/state — диагностируемая ошибка. На wire:

- нет сессии — `status:4`;
- неподдержанная/запрещённая операция — `status:203` с `error`;
- внутренняя ошибка — `status:204` с `error` и correlation log.

Логи структурированы и не содержат credentials, cookies, tokens или raw player
payload по умолчанию. Недоступная telemetry не блокирует gameplay.

## Последствия

- Старое рабочее поведение переносится без старой связности и service-locator
  подхода.
- Межмодульная атомарность допустима в общей БД, но orchestration использует
  public ports владельцев.
- Новый fallback или durable async mechanism требует отдельного решения и
  проверяемого сценария.
