# Architecture Decision Records

ADRs capture durable architectural decisions for `j-emu`. They describe the intended system boundaries; they are not an implementation plan.

## Status

- **Proposed**: under review.
- **Accepted**: the default for implementation.
- **Superseded**: replaced by a later ADR, which must link back.
- **Deprecated**: retained for history but no longer recommended.

Accepted ADRs are immutable except for typo and clarification fixes. Change a decision by adding a new ADR and marking the old one superseded.

## Index

1. [ADR-0001: Fastify and explicit composition root](ADR-0001-framework-and-composition.md)
2. [ADR-0002: Modular monolith boundaries](ADR-0002-modular-monolith.md)
3. [ADR-0003: Transactions, Unit of Work, and read models](ADR-0003-transactions-uow-read-models.md)
4. [ADR-0004: Domain events and transactional outbox](ADR-0004-events-and-outbox.md)
5. [ADR-0005: Content storage without dual-write — superseded](ADR-0005-content-storage.md)
6. [ADR-0006: Combat runtime extraction seam — superseded](ADR-0006-combat-runtime-seam.md)
7. [ADR-0007: Testing strategy — superseded](ADR-0007-testing-strategy.md)
8. [ADR-0008: Observability](ADR-0008-observability.md)
9. [ADR-0009: No implicit defaults or fallbacks](ADR-0009-no-implicit-defaults.md)
10. [ADR-0010: Drizzle persistence](ADR-0010-drizzle-persistence.md)
11. [ADR-0011: PostgreSQL content publication](ADR-0011-postgres-content-publication.md)
12. [ADR-0012: E2E-first testing](ADR-0012-e2e-first-testing.md)
13. [ADR-0013: Database-generated identifiers — superseded](ADR-0013-database-generated-identifiers.md)
14. [ADR-0014: Typed static command dispatch](ADR-0014-typed-static-command-dispatch.md)
15. [ADR-0015: Ephemeral combat and finished history](ADR-0015-ephemeral-combat-and-finished-history.md)
16. [ADR-0016: Live-derived ID allocation](ADR-0016-live-derived-id-allocation.md)

## Conventions

- Stateful domain and application boundaries use classes with explicit dependencies.
- Wire codecs, mapping, validation primitives, and deterministic calculations use pure functions.
- Modules communicate through published application interfaces and events, never another module's private tables or internals.
- Persistent access uses Drizzle; PostgreSQL generates runtime identifiers.
- Dynamic imports and production memory repositories are prohibited. Active
  combat hot state is the explicit process-local exception from ADR-0015.
- Client-visible behavior is accepted through raw-AMF E2E with PostgreSQL.
- Playerbots are outside the current system. If introduced, they will run as an external service using public commands/events rather than being embedded in the monolith.
