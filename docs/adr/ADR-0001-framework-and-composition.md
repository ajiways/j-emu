# ADR-0001: Fastify and explicit composition root

- Status: Superseded by [ADR-0017](ADR-0017-runtime-boundaries-and-fail-fast.md)
- Date: 2026-09-07

## Context

The server must preserve a legacy protocol: raw AMF request/response bodies, long-poll connections, and TCP-facing adapters. These paths need precise lifecycle, buffering, timeout, and error behavior. The application also needs dependency isolation without making transport or domain code depend on a framework container.

NestJS and Fastify were compared on:

- byte-for-byte access to raw bodies and responses;
- long-poll cancellation, backpressure, and shutdown behavior;
- TCP adapter integration;
- startup cost and request-path overhead;
- testability without booting the framework;
- amount of framework metadata required in domain/application code.

## Decision

Use Fastify as the HTTP host. Build dependencies in one explicit composition root at process startup and pass them through constructors or factory parameters.

Use classes for stateful infrastructure, application services, repositories, and session/runtime coordinators. Use pure functions for AMF codecs, wire mappings, rules, and calculations.

Domain and application modules must not import Fastify types. Route adapters decode input, invoke an application interface, and encode output. TCP and long-poll adapters follow the same rule.

NestJS is not adopted. Its module/container/decorator model adds coupling without solving a required capability; raw AMF, long-poll, and TCP integration benefit from direct control over transport lifecycles.

## Spike criteria

Before implementation, a thin executable spike must prove:

1. raw AMF bytes round-trip without implicit parsing;
2. long-poll requests cancel on disconnect and drain during shutdown;
3. a TCP adapter shares application services without importing HTTP code;
4. dependencies can be replaced in tests without global container state.

Failure of any criterion blocks adoption until resolved or this ADR is revisited.

## Consequences

- Dependency wiring is visible and type-checkable.
- Transport tests stay separate from domain tests.
- The composition root can become verbose; module factories may group wiring but may not become a service locator.
- Cross-cutting behavior must be deliberately registered as Fastify hooks or decorators at the edge.

## Revisit when

- the composition root becomes unmanageable despite module factories;
- measured operational needs require capabilities Fastify cannot provide cleanly;
- a NestJS spike demonstrates lower total coupling while satisfying all protocol criteria;
- multiple independently deployed HTTP applications require standardized container modules.
