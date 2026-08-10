# ADR-0002: deterministic policy decisions with atomic reservations

Status: accepted — 2026-08-06

## Context

Checking historical spend and returning `ALLOW` without reserving budget permits
concurrent requests to each observe the same remaining balance. An LLM decision
is also not a verifiable financial authorization boundary.

## Decision

The policy engine is a pure deterministic function. An application service must
lock the relevant agent/task counters, evaluate the same snapshot, persist the
decision and create a budget reservation in one database transaction before
returning `ALLOW`.

Every amount is an integer token base unit. `spent + reserved` is used for every
limit. `REQUIRE_APPROVAL` creates no reservation; approval execution must
re-evaluate the current policy and budget while verifying the original request
hash.

## Consequences

- The engine can be exhaustively unit tested without network or database state.
- The HTTP/database layer is responsible for isolation and retry semantics.
- Policy approval and payment settlement remain separate states.

