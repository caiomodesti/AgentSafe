# AgentSafe implementation status

Date: 2026-08-06

## Delivered

- Standalone `agentsafe/` package and lockfile with no runtime import from Solverdict.
- Strict TypeScript build and path-scoped GitHub Actions workflow.
- Integer base-unit financial contracts for agent, task, policy, history,
  allowance, intent, decision and `RiskFinding`.
- Deterministic policy engine with `ALLOW`, `DENY`, `REQUIRE_APPROVAL`, reason
  codes, matched rules, risk signals and remaining budgets.
- Limits for transaction, task, hour, day, week, lifetime, retries, paid calls,
  merchant, recipient, service category, price deviation, policy/task/allowance
  expiration, frozen agent and remaining onchain allowance.
- Stable SHA-256 request hashing for idempotency and approval binding.
- HMAC-protected agent API key generation/verification with lookup-safe prefix.
- Evaluation service/repository boundary that serializes financial evaluation,
  returns the stored idempotent result and reserves budget once.
- In-memory adapter limited to tests/demo; concurrency test proves two parallel
  requests cannot reserve the same task budget.
- Relative Agent Financial Risk Score with explainable contributors.
- Blast Radius calculation separating transaction, task and effective authority.
- Local simulator with ten controlled scenarios and explicit `SIMULATED` labels.
- Deterministic safe-policy draft generator with per-rule evidence.
- ResearchBot demo: 10 scenarios, 8 safe, 2 findings, score 72 HIGH, three
  allowed intents, two denied intents, 514 USDC blocked.
- Dedicated Supabase/Postgres migration for workspaces, RBAC, agents,
  credential hashes, treasuries, immutable policy versions, tasks, intents,
  decisions, reservations, approvals and append-only audit events.
- RLS on every tenant table and composite tenant foreign keys.

## Validation performed

```text
Solverdict root: lint:rpc + typecheck + unit tests PASS
Solverdict web:  typecheck + 7 unit suites PASS
Solverdict web:  production build PASS (existing dependency warnings only)
AgentSafe core:  typecheck + 38 tests + build PASS
ResearchBot:     executable demo PASS
```

The AgentSafe dependency graph contains seven development packages and reported
zero known vulnerabilities at installation time. The existing Solverdict graphs
reported vulnerabilities and deprecated transitive dependencies; they were not
modified as part of this isolated slice.

## Honest limitations

- The SQL migration has static contract guards but has not yet been applied to
  an ephemeral or hosted Supabase/Postgres instance in this environment.
- The in-memory evaluation repository demonstrates semantics only. It is not a
  distributed or durable enforcement store.
- No HTTP endpoint, Supabase Auth UI/session, live RLS integration test or agent
  API-key middleware exists yet.
- No wallet private key is stored or accepted. A production signer/KMS provider
  has not been selected.
- No Solana allowance, USDC devnet transfer, x402 settlement or pay.sh request
  has been submitted. All current ResearchBot attack data is explicitly simulated.
- The policy generator is deterministic v1 and uncalibrated; its multipliers are
  product defaults, not learned loss probabilities.

## Next vertical slice

1. Implement a PostgreSQL evaluation adapter using one transaction and row locks.
2. Add integration tests against ephemeral Postgres/Supabase, including RLS and
   cross-tenant access.
3. Expose authenticated `POST /v1/evaluate` with runtime schemas and scoped
   agent API keys.
4. Add approval, capture/release and freeze application services.
5. Only then implement the official Solana fixed-delegation adapter on devnet.
