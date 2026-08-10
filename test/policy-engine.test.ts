import assert from "node:assert/strict";
import test from "node:test";
import type { EvaluationInput, PaymentIntent, PolicyRules } from "../src/domain.js";
import { evaluatePayment } from "../src/policy-engine.js";

const NOW = "2026-08-06T12:00:00.000Z";

const rules: PolicyRules = {
  maxTransactionBaseUnits: 2_000_000n,
  maxTaskBaseUnits: 3_000_000n,
  maxHourlyBaseUnits: 5_000_000n,
  maxDailyBaseUnits: 20_000_000n,
  maxWeeklyBaseUnits: 80_000_000n,
  maxLifetimeBaseUnits: 200_000_000n,
  allowedMerchants: ["Tavily", "Gemini"],
  deniedMerchants: ["Blocked Casino"],
  allowedRecipients: ["SafeRecipient111111111111111111111111111111"],
  unknownMerchantAction: "REQUIRE_APPROVAL",
  unknownRecipientAction: "DENY",
  newMerchantApprovalThresholdBaseUnits: 500_000n,
  maxPriceDeviationBps: 30_000,
  maxRetries: 3,
  maxPaidCallsPerTask: 100,
  allowedServiceCategories: ["search", "inference", "data"],
};

function fixture(overrides: {
  intent?: Partial<PaymentIntent>;
  agent?: Partial<EvaluationInput["agent"]>;
  task?: Partial<EvaluationInput["task"]>;
  history?: Partial<EvaluationInput["history"]>;
  allowance?: Partial<EvaluationInput["allowance"]>;
  policy?: Partial<EvaluationInput["policy"]>;
  rules?: Partial<PolicyRules>;
} = {}): EvaluationInput {
  return {
    now: NOW,
    intent: {
      id: "intent-1",
      workspaceId: "workspace-1",
      agentId: "agent-1",
      taskId: "task-1",
      amountBaseUnits: 1_000_000n,
      token: "USDC",
      chain: "SOLANA",
      network: "DEVNET",
      merchant: "Tavily",
      recipient: "SafeRecipient111111111111111111111111111111",
      serviceCategory: "search",
      tool: "web-search",
      retryAttempt: 0,
      requestedAt: NOW,
      metadata: { purpose: "market research" },
      ...overrides.intent,
    },
    agent: { status: "ACTIVE", ...overrides.agent },
    task: {
      approvedBudgetBaseUnits: 3_000_000n,
      spentBaseUnits: 0n,
      reservedBaseUnits: 0n,
      expiresAt: "2026-08-07T12:00:00.000Z",
      ...overrides.task,
    },
    history: {
      hourlySpentBaseUnits: 0n,
      hourlyReservedBaseUnits: 0n,
      dailySpentBaseUnits: 0n,
      dailyReservedBaseUnits: 0n,
      weeklySpentBaseUnits: 0n,
      weeklyReservedBaseUnits: 0n,
      lifetimeSpentBaseUnits: 0n,
      lifetimeReservedBaseUnits: 0n,
      merchantSeen: true,
      medianPriceBaseUnits: 500_000n,
      paidCallsForTask: 0,
      ...overrides.history,
    },
    allowance: {
      remainingBaseUnits: 20_000_000n,
      expiresAt: "2026-08-13T12:00:00.000Z",
      ...overrides.allowance,
    },
    policy: {
      id: "policy-1",
      versionId: "policy-version-1",
      version: 1,
      status: "ACTIVE",
      chain: "SOLANA",
      network: "DEVNET",
      token: "USDC",
      effectiveFrom: "2026-08-01T00:00:00.000Z",
      expiresAt: "2026-08-13T12:00:00.000Z",
      rules: { ...rules, ...overrides.rules },
      ...overrides.policy,
    },
  };
}

test("allows an amount exactly equal to the transaction limit", () => {
  const decision = evaluatePayment(
    fixture({
      intent: { amountBaseUnits: 2_000_000n },
      history: { medianPriceBaseUnits: 1_000_000n },
    }),
  );

  assert.equal(decision.decision, "ALLOW");
  assert.equal(decision.reservationAmountBaseUnits, 2_000_000n);
  assert.equal(decision.remainingTaskBudgetBaseUnits, 1_000_000n);
});

test("denies one base unit over the transaction limit", () => {
  const decision = evaluatePayment(fixture({ intent: { amountBaseUnits: 2_000_001n } }));
  assert.equal(decision.decision, "DENY");
  assert.deepEqual(decision.reasonCodes, ["TRANSACTION_LIMIT_EXCEEDED"]);
  assert.equal(decision.reservationAmountBaseUnits, undefined);
});

test("includes existing reservations when enforcing task budget", () => {
  const decision = evaluatePayment(
    fixture({
      intent: { amountBaseUnits: 1_000_001n },
      task: { spentBaseUnits: 1_000_000n, reservedBaseUnits: 1_000_000n },
    }),
  );
  assert.equal(decision.decision, "DENY");
  assert.deepEqual(decision.reasonCodes, ["TASK_BUDGET_EXCEEDED"]);
});

test("frozen agent fails closed before merchant evaluation", () => {
  const decision = evaluatePayment(
    fixture({ agent: { status: "FROZEN" }, intent: { merchant: "Unknown Provider" } }),
  );
  assert.equal(decision.decision, "DENY");
  assert.deepEqual(decision.reasonCodes, ["AGENT_FROZEN"]);
});

test("policy expiration uses a hard exclusive boundary", () => {
  const decision = evaluatePayment(fixture({ policy: { expiresAt: NOW } }));
  assert.equal(decision.decision, "DENY");
  assert.deepEqual(decision.reasonCodes, ["POLICY_EXPIRED"]);
});

test("explicitly denied merchant cannot be escalated to approval", () => {
  const decision = evaluatePayment(
    fixture({ intent: { merchant: " blocked casino ", amountBaseUnits: 100_000n } }),
  );
  assert.equal(decision.decision, "DENY");
  assert.deepEqual(decision.reasonCodes, ["DENIED_MERCHANT"]);
});

test("unknown merchant requires approval while preserving current budgets", () => {
  const decision = evaluatePayment(
    fixture({
      intent: { merchant: "PremiumData", amountBaseUnits: 400_000n },
      history: { merchantSeen: false, medianPriceBaseUnits: 0n },
    }),
  );
  assert.equal(decision.decision, "REQUIRE_APPROVAL");
  assert.deepEqual(decision.reasonCodes, ["UNKNOWN_MERCHANT"]);
  assert.equal(decision.remainingTaskBudgetBaseUnits, 3_000_000n);
  assert.equal(decision.reservationAmountBaseUnits, undefined);
});

test("new merchant above the first-purchase threshold requires approval", () => {
  const decision = evaluatePayment(
    fixture({
      intent: { amountBaseUnits: 500_001n },
      history: { merchantSeen: false, medianPriceBaseUnits: 0n },
    }),
  );
  assert.equal(decision.decision, "REQUIRE_APPROVAL");
  assert.deepEqual(decision.reasonCodes, ["APPROVAL_REQUIRED"]);
  assert.ok(decision.riskSignals.includes("new-merchant"));
});

test("unknown recipient is denied", () => {
  const decision = evaluatePayment(fixture({ intent: { recipient: "UnknownRecipient" } }));
  assert.equal(decision.decision, "DENY");
  assert.deepEqual(decision.reasonCodes, ["RECIPIENT_NOT_ALLOWED"]);
});

test("retry number equal to max is allowed and max plus one is denied", () => {
  assert.equal(evaluatePayment(fixture({ intent: { retryAttempt: 3 } })).decision, "ALLOW");
  const denied = evaluatePayment(fixture({ intent: { retryAttempt: 4 } }));
  assert.equal(denied.decision, "DENY");
  assert.deepEqual(denied.reasonCodes, ["RETRY_LIMIT"]);
});

test("price exactly 3x median is allowed and one unit above is denied", () => {
  const exact = evaluatePayment(
    fixture({ intent: { amountBaseUnits: 1_500_000n }, history: { medianPriceBaseUnits: 500_000n } }),
  );
  assert.equal(exact.decision, "ALLOW");

  const above = evaluatePayment(
    fixture({ intent: { amountBaseUnits: 1_500_001n }, history: { medianPriceBaseUnits: 500_000n } }),
  );
  assert.equal(above.decision, "DENY");
  assert.deepEqual(above.reasonCodes, ["PRICE_SPIKE"]);
});

test("daily limit includes spend and reservations", () => {
  const decision = evaluatePayment(
    fixture({
      intent: { amountBaseUnits: 1_000_001n },
      history: { dailySpentBaseUnits: 18_000_000n, dailyReservedBaseUnits: 1_000_000n },
    }),
  );
  assert.equal(decision.decision, "DENY");
  assert.deepEqual(decision.reasonCodes, ["DAILY_LIMIT_EXCEEDED"]);
});

test("network mismatch fails before spending checks", () => {
  const decision = evaluatePayment(fixture({ policy: { network: "MAINNET" } }));
  assert.equal(decision.decision, "DENY");
  assert.deepEqual(decision.reasonCodes, ["NETWORK_MISMATCH"]);
});

test("invalid non-positive amount fails closed", () => {
  const decision = evaluatePayment(fixture({ intent: { amountBaseUnits: 0n } }));
  assert.equal(decision.decision, "DENY");
  assert.deepEqual(decision.reasonCodes, ["INVALID_INTENT"]);
});
