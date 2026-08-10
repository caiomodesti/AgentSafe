import assert from "node:assert/strict";
import test from "node:test";
import type { PaymentIntent, PolicyDecision } from "../src/domain.js";
import { authorizeOnchainExecution } from "../src/onchain-execution.js";
import type { ObservedFixedAllowance } from "../src/solana-allowance.js";

const intent: PaymentIntent = {
  id: "intent-1", workspaceId: "workspace-1", agentId: "agent-1", taskId: "task-1",
  amountBaseUnits: 1_000_000n, token: "USDC", chain: "SOLANA", network: "DEVNET",
  merchant: "Tavily", recipient: "SafeRecipient", retryAttempt: 0,
  requestedAt: "2026-08-07T00:00:00.000Z", metadata: {},
};
const decision: PolicyDecision = {
  decision: "ALLOW", reasonCodes: [], humanReadableExplanation: "allowed", matchedRuleIds: [], riskSignals: [],
  policyVersionId: "policy-v1", remainingTaskBudgetBaseUnits: 2_000_000n,
  remainingDailyBudgetBaseUnits: 19_000_000n, reservationAmountBaseUnits: 1_000_000n,
};
const allowance: ObservedFixedAllowance = {
  network: "DEVNET", delegationAddress: "delegation", owner: "owner", delegatee: "delegatee", mint: "mint",
  remainingBaseUnits: 20_000_000n, expiresAt: "2030-01-01T00:00:00.000Z", expired: false, source: "ONCHAIN",
};

test("binds a deterministic allow decision to a reconciled allowance", () => {
  const approved = authorizeOnchainExecution({ intent, decision, allowance, now: "2026-08-07T00:00:00.000Z" });
  assert.equal(approved.authorization, "AGENTSAFE_ONCHAIN_EXECUTION_V1");
  assert.equal(approved.amountBaseUnits, 1_000_000n);
  assert.equal(approved.policyVersionId, "policy-v1");
  assert.match(approved.requestHash, /^[0-9a-f]{64}$/);
});

test("refuses denied decisions, expired authority and oversize intents", () => {
  assert.throws(() => authorizeOnchainExecution({ intent, decision: { ...decision, decision: "DENY" }, allowance, now: "2026-08-07T00:00:00.000Z" }), /ALLOW/);
  assert.throws(() => authorizeOnchainExecution({ intent, decision, allowance: { ...allowance, expired: true }, now: "2026-08-07T00:00:00.000Z" }), /expired/);
  assert.throws(() => authorizeOnchainExecution({ intent: { ...intent, amountBaseUnits: 20_000_001n }, decision, allowance, now: "2026-08-07T00:00:00.000Z" }), /insufficient/);
});
