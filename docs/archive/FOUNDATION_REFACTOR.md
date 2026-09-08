# Foundation refactor — завершено

Историческая запись завершённого инфраструктурного этапа.

К 2026-09-07 foundation переведён на:

- PostgreSQL + Drizzle;
- module-owned schemas и pre-baseline migrations;
- database-generated persistent IDs;
- versioned content drafts/releases/publication;
- typed static OA/fproxy/esrv registries;
- E2E через Fastify, raw AMF и отдельную PostgreSQL test DB;
- module factories и automated architecture/dead-code gates;
- process-local active combat и 72-hour finished history.

Текущие правила находятся в `docs/architecture`, актуальные решения — в
`docs/adr`, продуктовый статус — в `docs/CAPABILITIES.md`.

Исходный подробный план сохранён в git history. Для новых работ используется
[дорожная карта переноса](../migration/ROADMAP.md).
