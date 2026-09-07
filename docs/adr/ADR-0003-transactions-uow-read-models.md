# ADR-0003: Transactions, Unit of Work, and read models

- Status: Accepted
- Date: 2026-09-07

## Context

Gameplay commands often update several records atomically. Queries have different shapes and performance needs from domain writes. Hiding transaction scope inside repositories risks partial commits and makes event persistence unreliable.

## Decision

One application command executes inside one explicit database transaction owned by a `UnitOfWork`. The application service defines the boundary; repositories participate through the transaction-bound context supplied by the Unit of Work and never commit independently.

Transactions cover only local database state and transactional outbox records. Network calls, long-poll waits, TCP writes, and expensive calculations occur outside the transaction. Conflicting writes use optimistic concurrency or deliberate row locks, selected per invariant.

Write repositories load and persist aggregates owned by their module. Queries use dedicated read-model functions or query classes that return immutable DTOs and may join across module-owned tables read-only. Read models cannot be written back as domain state.

Nested transactions are prohibited. A called application service either joins the existing Unit of Work through an explicit context or is invoked after commit as a separate command.

## Consequences

- Atomicity and commit ownership are visible.
- Domain writes and outbox publication share one commit.
- Read paths avoid unnecessary aggregate hydration.
- Application services must pass transaction context explicitly.
- Cross-module read models couple to schemas and require contract tests during migrations.

## Revisit when

- commands must atomically span separate databases;
- transaction contention exceeds agreed latency/error objectives;
- read volume requires independently stored projections;
- explicit transaction propagation produces repeated defects that a different scoped mechanism demonstrably prevents.
