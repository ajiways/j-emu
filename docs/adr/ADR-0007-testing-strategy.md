# ADR-0007: Testing strategy

- Status: Superseded by [ADR-0012](ADR-0012-e2e-first-testing.md)
- Date: 2026-09-07

## Context

Protocol fidelity, transactional correctness, deterministic game rules, and module isolation fail in different ways. One test style cannot cover all of them economically.

## Decision

Use a layered test suite:

1. Pure unit tests cover codecs, calculations, mappings, and rules with deterministic clocks and random seeds.
2. Application tests exercise stateful service classes through public interfaces with controlled dependencies.
3. Repository and Unit-of-Work integration tests use the real database engine and verify commit, rollback, locking, and outbox atomicity.
4. Module contract tests prevent private imports/table writes and verify public command, query, and event schemas.
5. Transport contract tests replay canonical raw AMF, HTTP long-poll, and TCP fixtures byte-for-byte where applicable.
6. A small end-to-end suite boots the composition root and covers critical player journeys.
7. Combat parity tests run the same serialized command cases against the local runtime adapter and extraction contract harness.

Tests must not depend on ordering, wall-clock time, shared player state, or external services. Every defect in a deterministic boundary receives the narrowest practical regression test.

## Consequences

- Most failures are localized and fast to diagnose.
- Real database and transport tests require managed test infrastructure.
- Canonical wire fixtures require deliberate review when behavior changes.
- End-to-end coverage stays intentionally small rather than replacing lower-level tests.

## Revisit when

- suite duration exceeds CI targets;
- production defects cluster in a layer with inadequate coverage;
- protocol fixture churn obscures meaningful regressions;
- service extraction introduces network failure modes not represented by current contracts.
