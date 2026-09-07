# ADR-0005: Content storage without dual-write

- Status: Superseded by [ADR-0011](ADR-0011-postgres-content-publication.md)
- Date: 2026-09-07

## Context

Game content must be editable, reviewable, and consumable at runtime. Writing the same content to files and a database in one user operation creates two authorities and ambiguous recovery when one write fails.

## Decision

Authored content files in version control are the sole source of truth. They use explicit schemas and stable identifiers. Runtime storage is a generated, versioned projection produced by a deterministic import/build step.

Editors write only authored content. Runtime services read only the active imported projection. No request, editor action, or repository may dual-write authored files and runtime database rows.

Import validates references and schemas, builds a complete candidate revision, and atomically activates it only after success. Each revision records its source commit/hash and schema version. Rollback selects a previously built revision; runtime mutations never flow back into authored content.

Content mapping and validation are pure functions where no I/O is required. Import coordination and revision activation are stateful classes with explicit dependencies.

## Consequences

- Ownership and recovery are unambiguous.
- Runtime data may lag authored changes until import succeeds.
- The importer and schema migrations become production-critical.
- Derived runtime indexes can be rebuilt rather than hand-repaired.

## Revisit when

- nontechnical authors require concurrent server-side editing that version-controlled files cannot support;
- import duration violates deployment objectives;
- content includes operational state that cannot be regenerated;
- a new authoritative store can replace files through a one-way migration with no dual-write period.
