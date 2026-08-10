import assert from "node:assert/strict";
import test from "node:test";
import { analyzeFinancialCapabilities } from "../src/capability-analysis.js";

test("discovers the eight required risks from an agent without financial controls", () => {
  const analysis = analyzeFinancialCapabilities("researchbot", {});
  assert.deepEqual(
    analysis.findings.map((finding) => finding.category),
    [
      "NO_TRANSACTION_LIMIT",
      "NO_TASK_BUDGET",
      "UNLIMITED_RETRIES",
      "UNRESTRICTED_MERCHANTS",
      "UNRESTRICTED_RECIPIENTS",
      "RUNAWAY_LOOP_RISK",
      "PRICE_SPIKE_RISK",
      "ABNORMAL_SPENDING_VELOCITY",
    ],
  );
  assert.ok(analysis.findings.every((finding) => finding.trigger.source === "OBSERVED_CAPABILITY"));
});

test("does not report controls that are present in the observed agent capability profile", () => {
  const analysis = analyzeFinancialCapabilities("controlled-agent", {
    maxTransactionBaseUnits: 2_000_000n,
    taskBudgetBaseUnits: 3_000_000n,
    maxRetries: 3,
    allowedMerchants: ["Tavily"],
    allowedRecipients: ["SafeRecipient"],
    maxPaidCallsPerTask: 100,
    priceDeviationGuardBps: 30_000,
    maxHourlySpendBaseUnits: 5_000_000n,
  });
  assert.deepEqual(analysis.findings, []);
});
