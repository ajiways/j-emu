# ADR-0009: No implicit defaults or fallbacks

- Status: Accepted
- Date: 2026-09-07

## Context

The legacy proof of concept frequently recovered from incomplete configuration,
content, state, and requests by inserting empty, zero, historical, or unrelated
values. That keeps a request moving but corrupts the observable game state and
makes wire failures non-deterministic.

## Decision

Mandatory data is mandatory at every boundary. Its absence is an explicit,
diagnosable failure and never triggers substitution.

- Configuration has no defaults. Startup validates every required environment
  variable and policy document field.
- Domain creation receives a complete named policy. Constructor constants are
  allowed only for true invariants, never as missing-input replacements.
- Missing catalog rows, world links, handlers, relations, and persisted state
  fail explicitly.
- Unsupported gameplay returns documented `status:203` with `error`.
- Missing sessions return `status:4`; unexpected operation failures return
  `status:204` and are logged with request context.
- Importers reject malformed and incomplete input atomically.
- Tests use complete builders/fixtures and assert negative fail-fast paths.

Multiple explicitly documented wire representations of one field are protocol
variants, not fallback. They must be decoded by a named compatibility mapper
and covered by fixtures. An empty collection is valid only when it represents
authoritative stored state, not a failed lookup.

## Consequences

- Configuration and content errors stop deployment or the affected operation
  close to their source.
- Every initial gameplay value lives in a validated policy or published content
  revision.
- Adding a compatibility substitution requires a new ADR with client evidence;
  a local convenience is insufficient justification.
- Error handling is more visible, and incomplete vertical slices cannot claim
  success through empty `status:100` responses.
