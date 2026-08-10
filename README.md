# AgentSafe core

Standalone foundation for AgentSafe's deterministic financial security layer.
It intentionally imports nothing from the Solverdict benchmark or SaaS.

Implemented in this slice:

- canonical `PaymentIntent`, `Policy`, context and decision contracts;
- deterministic `ALLOW`, `DENY` and `REQUIRE_APPROVAL` policy evaluation;
- integer base-unit money invariants;
- stable request hashing for idempotency and approval binding;
- serialized evaluation service contract with idempotency and reservations;
- local 10-scenario simulator and versioned `RiskFinding` output;
- deterministic risk score, policy recommendation and Blast Radius;
- executable, explicitly simulated ResearchBot core-loop demo;
- PostgreSQL tenancy/RBAC/RLS foundation and financial ledger schema;
- Solana Devnet delegated-authority proof: a permitted transfer and an on-chain blocked boundary attempt;
- public Portuguese presentation site with an interactive one-wallet Devnet Lab.
- boundary and security-focused unit tests.

Not implemented yet:

- HTTP API, authentication UI or API-key middleware;
- PostgreSQL adapter for the evaluation transaction contract;
- production payment execution, a persistent Solana allowance adapter and x402;
- production key management.

## Commands

Use Node 22 and npm 11 or newer.

```bash
npm ci
npm run check
npm run demo:researchbot
```

## Independence boundary

Code under this directory must not import `../env`, `../scenarios`,
`../scoring`, `../setups`, or `../web`. Future Solverdict integration is through
the versioned `RiskFinding` contract only.
