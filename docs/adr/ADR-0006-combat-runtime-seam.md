# ADR-0006: Combat runtime extraction seam

- Status: Superseded by [ADR-0015](ADR-0015-ephemeral-combat-and-finished-history.md)
- Date: 2026-09-07

## Context

Combat is stateful, latency-sensitive, and likely to have different scaling and failure characteristics from account and content workflows. Premature service extraction would add networking and consistency complexity, but an accidental in-process API would make later extraction costly.

## Decision

Combat remains an in-process module behind a transport-neutral `CombatRuntime` application port. Callers submit serializable commands containing stable identifiers, expected combat version, idempotency key, and command payload. Results and emitted events are serializable contracts; callers never hold combat entities or mutable references.

A stateful runtime class owns combat sessions, command ordering, persistence checkpoints, timers, and recovery. Combat rules, target selection, damage, and other deterministic calculations are pure functions over explicit inputs.

The adapter must support asynchronous invocation even while local. Persistent game state changes caused by combat outcomes enter owning modules through commands/events, not direct table writes. Wire-specific AMF and TCP mapping remains outside combat.

The seam is tested with both the in-process adapter and a contract harness that serializes every command/result/event. This is an extraction seam, not a commitment to extraction.

## Consequences

- Local execution avoids network latency today.
- Serializable contracts prevent object-graph coupling.
- Async APIs and idempotency add discipline and some overhead.
- Cross-boundary operations cannot rely on a shared transaction.

## Revisit when

- combat CPU, memory, or availability needs independent scaling;
- process pauses measurably harm combat latency;
- deployments must preserve active fights independently;
- the serialization contract cannot represent required interactions without excessive chattiness.
