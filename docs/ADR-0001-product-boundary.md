# ADR-0001: AgentSafe is a standalone product boundary

Status: accepted — 2026-08-06

## Context

Solverdict discovers behavioral failures through adversarial testing. AgentSafe
evaluates and limits financial authority at runtime. Sharing the benchmark
runner, database or payment configuration would make AgentSafe availability and
security depend on a separate research product.

## Decision

AgentSafe lives under an independent package root with its own lockfile, tests,
database migrations, credentials and deployment lifecycle. It imports no
Solverdict runtime modules. Future integration accepts only a versioned
`agentsafe.risk-finding.v1` contract.

## Consequences

- Either product can run without the other.
- Security and release changes cannot silently alter benchmark methodology.
- Some generic primitives may initially be duplicated and extracted only after
  their contract is stable.

