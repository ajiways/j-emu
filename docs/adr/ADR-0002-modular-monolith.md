# ADR-0002: Modular monolith boundaries

- Status: Superseded by [ADR-0017](ADR-0017-runtime-boundaries-and-fail-fast.md)
- Date: 2026-09-07

## Context

The emulator needs strong ownership boundaries, but distributing latency-sensitive gameplay across services would add failure modes before independent scaling or deployment is justified.

## Decision

Build one deployable modular monolith. Initial business modules are:

- identity and sessions;
- characters and inventory;
- world and content;
- quests;
- combat;
- social/messaging;
- economy.

Each module owns its domain model, application services, persistence mappings, and database tables. Its public surface consists only of application commands/queries, stable value DTOs, and published events. Direct imports of another module's repositories, entities, or internal services are forbidden. Cross-module writes occur through the owning module's application interface.

Shared code is limited to technical primitives such as identifiers, clocks, transaction abstractions, codecs, and telemetry. A generic `common` domain package is not allowed.

Stateful application boundaries are classes. Deterministic validation, mapping, codecs, and calculations are pure functions.

Playerbots are omitted. A future playerbot implementation is an external service that behaves as a client through public commands/events; it does not receive in-process access to domain objects or tables.

## Consequences

- One process and database keep deployment and synchronous gameplay simple.
- Ownership and dependency direction remain explicit and enforceable.
- Some workflows require orchestration through public interfaces or events instead of convenient table access.
- Modules can be extracted later, but no extraction is assumed.

## Revisit when

- a module needs independent release cadence, scaling, availability, or security isolation;
- profiling shows a module cannot coexist within process resource limits;
- ownership violations recur despite dependency tests;
- an external integration requires a separately deployable boundary.
