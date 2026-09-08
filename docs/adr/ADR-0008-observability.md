# ADR-0008: Observability

- Status: Superseded by [ADR-0017](ADR-0017-runtime-boundaries-and-fail-fast.md)
- Date: 2026-09-07

## Context

Legacy wire traffic, long-lived requests, asynchronous events, and combat sessions make failures difficult to reconstruct from unstructured messages. Diagnostics must preserve correlation without exposing credentials or raw player data.

## Decision

Emit structured JSON logs, metrics, and distributed traces through OpenTelemetry-compatible interfaces configured in the composition root.

Every inbound request or connection receives a correlation id. Commands, Unit-of-Work transactions, outbox events, long-poll deliveries, and combat commands propagate correlation and causation identifiers. Spans cover transport decode/encode, application commands, database transactions, outbox dispatch, and combat turns.

Metrics include request rate/latency/errors by operation, active and timed-out long polls, TCP connections, transaction retries, outbox depth/age/failures, combat command latency/version conflicts, and content revision/import status. Labels must be bounded; player, session, fight, and event ids belong in logs/traces, never metric labels.

Logs must redact credentials, cookies, tokens, chat text by default, and sensitive AMF payload fields. Raw payload capture is disabled by default and may be enabled only through sampled, access-controlled diagnostics with retention limits.

Operational health endpoints distinguish liveness from readiness. Readiness fails when required dependencies or the active content revision are unavailable, but not solely because optional telemetry export is down.

## Consequences

- Requests and asynchronous effects can be traced end to end.
- Instrumentation and context propagation add code and runtime cost.
- Cardinality and retention require active governance.
- Telemetry export failure cannot block gameplay; bounded buffering and dropping are required.

## Revisit when

- telemetry overhead exceeds its budget;
- incident reviews identify missing correlation or signals;
- privacy requirements prohibit recorded fields;
- combat is extracted and requires revised cross-process sampling or propagation.
