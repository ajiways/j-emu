# ADR-0004: Domain events and transactional outbox

- Status: Accepted
- Date: 2026-09-07

## Context

Modules need to react to committed state changes without direct internal coupling. Publishing before commit exposes uncommitted data; publishing after commit without durable coordination loses events on process failure.

## Decision

Aggregates may record immutable domain events in past tense. The application layer maps them to versioned integration events where a stable cross-module contract is needed.

During the command transaction, the Unit of Work persists state changes and integration events to an outbox table atomically. A background dispatcher claims committed rows, publishes them to in-process subscribers and external transports, and marks them delivered.

Delivery is at least once. Every consumer must be idempotent using the event identifier or a business idempotency key. Event envelopes include event id, type, schema version, aggregate id, occurred-at time, correlation id, causation id, and payload.

Events communicate facts, not requests for immediate success. Invariants that require synchronous confirmation use an owning module's application command inside a deliberate orchestration flow.

## Consequences

- State and event persistence cannot diverge.
- Consumers can be retried and later moved out of process.
- Handlers must tolerate duplicates and delayed ordering.
- The outbox needs claiming, retention, dead-letter handling, and lag monitoring.
- Event schemas become compatibility contracts.

## Revisit when

- event throughput or retention outgrows the database outbox;
- strict global ordering becomes a demonstrated requirement;
- an external broker can participate with equivalent durability and simpler operations;
- duplicate handling proves infeasible for a specific integration.
