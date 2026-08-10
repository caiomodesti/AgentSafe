import assert from "node:assert/strict";
import test from "node:test";
import type { InMemoryFinancialState, PaymentIntent, PolicyRules } from "../src/index.js";
import {
  EvaluationService,
  IdempotencyConflictError,
  InMemoryEvaluationRepository,
} from "../src/evaluation-service.js";

const NOW = "2026-08-06T12:00:00.000Z";
const RECIPIENT = "SafeRecipient";

const rules: PolicyRules = {
  maxTransactionBaseUnits: 2_000_000n,
  maxTaskBaseUnits: 3_000_000n,
  maxHourlyBaseUnits: 5_000_000n,
  maxDailyBaseUnits: 20_000_000n,
  allowedMerchants: ["Tavily"],
  deniedMerchants: [],
  allowedRecipients: [RECIPIENT],
  unknownMerchantAction: "REQUIRE_APPROVAL",
  unknownRecipientAction: "DENY",
  newMerchantApprovalThresholdBaseUnits: 500_000n,
  maxPriceDeviationBps: 30_000,
  maxRetries: 3,
  maxPaidCallsPerTask: 100,
  allowedServiceCategories: ["search"],
};

function state(): InMemoryFinancialState {
  return {
    workspaceId: "workspace-1",
    agentId: "agent-1",
    taskId: "task-1",
    agent: { status: "ACTIVE" },
    task: {
      approvedBudgetBaseUnits: 3_000_000n,
      spentBaseUnits: 0n,
      reservedBaseUnits: 0n,
      expiresAt: "2026-08-07T12:00:00.000Z",
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
      medianPriceBaseUnits: 1_000_000n,
      paidCallsForTask: 0,
    },
    allowance: {
      remainingBaseUnits: 20_000_000n,
      expiresAt: "2026-08-07T12:00:00.000Z",
    },
    policy: {
      id: "policy-1",
      versionId: "policy-v1",
      version: 1,
      status: "ACTIVE",
      chain: "SOLANA",
      network: "DEVNET",
      token: "USDC",
      effectiveFrom: "2026-08-01T00:00:00.000Z",
      expiresAt: "2026-08-07T12:00:00.000Z",
      rules,
    },
  };
}

function intent(id: string, amountBaseUnits = 1_000_000n, merchant = "Tavily"): PaymentIntent {
  return {
    id,
    workspaceId: "workspace-1",
    agentId: "agent-1",
    taskId: "task-1",
    amountBaseUnits,
    token: "USDC",
    chain: "SOLANA",
    network: "DEVNET",
    merchant,
    recipient: RECIPIENT,
    serviceCategory: "search",
    retryAttempt: 0,
    requestedAt: NOW,
    metadata: {},
  };
}

test("same idempotent request returns the stored decision without double reservation", async () => {
  const repository = new InMemoryEvaluationRepository([state()]);
  const service = new EvaluationService(repository);
  const command = {
    idempotencyKey: "idempotency-key-0001",
    now: NOW,
    intent: intent("intent-1"),
  };

  const first = await service.evaluate(command);
  const second = await service.evaluate(command);
  assert.deepEqual(second, first);
  assert.equal(repository.snapshot("workspace-1", "agent-1", "task-1").task.reservedBaseUnits, 1_000_000n);
});

test("same idempotency key with a changed payload is rejected", async () => {
  const repository = new InMemoryEvaluationRepository([state()]);
  const service = new EvaluationService(repository);
  await service.evaluate({
    idempotencyKey: "idempotency-key-0001",
    now: NOW,
    intent: intent("intent-1"),
  });

  await assert.rejects(
    service.evaluate({
      idempotencyKey: "idempotency-key-0001",
      now: NOW,
      intent: intent("intent-2", 1_000_001n),
    }),
    IdempotencyConflictError,
  );
});

test("parallel requests cannot reserve the same task budget", async () => {
  const repository = new InMemoryEvaluationRepository([state()]);
  const service = new EvaluationService(repository);
  const results = await Promise.all([
    service.evaluate({
      idempotencyKey: "parallel-request-0001",
      now: NOW,
      intent: intent("intent-1", 2_000_000n),
    }),
    service.evaluate({
      idempotencyKey: "parallel-request-0002",
      now: NOW,
      intent: intent("intent-2", 2_000_000n),
    }),
  ]);

  assert.deepEqual(
    results.map((result) => result.decision).sort(),
    ["ALLOW", "DENY"],
  );
  assert.ok(results.some((result) => result.reasonCodes.includes("TASK_BUDGET_EXCEEDED")));
  assert.equal(repository.snapshot("workspace-1", "agent-1", "task-1").task.reservedBaseUnits, 2_000_000n);
});

test("approval-required request does not reserve budget", async () => {
  const repository = new InMemoryEvaluationRepository([state()]);
  const service = new EvaluationService(repository);
  const decision = await service.evaluate({
    idempotencyKey: "approval-request-0001",
    now: NOW,
    intent: intent("intent-1", 400_000n, "NewMerchant"),
  });

  assert.equal(decision.decision, "REQUIRE_APPROVAL");
  assert.equal(repository.snapshot("workspace-1", "agent-1", "task-1").task.reservedBaseUnits, 0n);
});

