import assert from "node:assert/strict";
import test from "node:test";
import { runResearchBotDemo } from "../src/demo/researchbot.js";
import { generateSafePolicy } from "../src/policy-generator.js";
import { LocalSimulationProvider } from "../src/simulation.js";

test("local simulator records controlled scenarios and versioned findings", () => {
  const result = new LocalSimulationProvider().simulateAgent({
    agentId: "agent-1",
    taskId: "task-1",
    controls: {
      unknownMerchantBlocked: true,
      unknownRecipientBlocked: true,
      maxPaidCallsPerTask: 100,
      maxSubagents: 4,
      taskBudgetBaseUnits: 3_000_000n,
      priceDeviationGuardBps: 30_000,
      promptTriggeredPaymentsBlocked: true,
    },
  });

  assert.equal(result.environment, "SIMULATED");
  assert.equal(result.scenarios.length, 10);
  assert.deepEqual(
    result.findings.map((finding) => finding.scenario),
    ["RETRY_STORM", "EXPENSIVE_PROVIDER"],
  );
  assert.ok(result.findings.every((finding) => finding.schemaVersion === "agentsafe.risk-finding.v1"));
  assert.ok(result.scenarios.every((scenario) => scenario.environment === "SIMULATED"));
});

test("policy generator converts baselines and findings into an explainable draft", () => {
  const simulation = new LocalSimulationProvider().simulateAgent({
    agentId: "agent-1",
    taskId: "task-1",
    controls: {
      unknownMerchantBlocked: true,
      unknownRecipientBlocked: true,
      maxPaidCallsPerTask: 100,
      maxSubagents: 4,
      taskBudgetBaseUnits: 3_000_000n,
      priceDeviationGuardBps: 30_000,
      promptTriggeredPaymentsBlocked: true,
    },
  });
  const recommendation = generateSafePolicy({
    successfulRequestP96BaseUnits: 1_140_000n,
    expectedTaskCostBaseUnits: 800_000n,
    findings: simulation.findings,
    verifiedMerchants: ["Tavily"],
    verifiedRecipients: ["SafeRecipient"],
  });

  assert.equal(recommendation.status, "DRAFT");
  assert.equal(recommendation.generatedBy, "DETERMINISTIC_V1");
  assert.equal(recommendation.rules.maxTransactionBaseUnits, 2_000_000n);
  assert.equal(recommendation.rules.maxTaskBaseUnits, 3_000_000n);
  assert.equal(recommendation.rules.maxHourlyBaseUnits, 5_000_000n);
  assert.equal(recommendation.rules.maxDailyBaseUnits, 20_000_000n);
  assert.equal(recommendation.rules.maxRetries, 3);
  assert.ok(recommendation.explanations.every((item) => item.evidence.length > 0));
});

test("ResearchBot demo reproduces the core story without presenting simulation as live", () => {
  const demo = runResearchBotDemo();
  assert.equal(demo.environment, "SIMULATED");
  assert.deepEqual(demo.simulationSummary, { total: 10, safe: 1, risksDetected: 9 });
  assert.equal(demo.riskFindings.length, 8);
  assert.equal(demo.riskScore.score, 78);
  assert.equal(demo.riskScore.level, "HIGH");
  assert.deepEqual(
    demo.decisions.map((decision) => decision.decision),
    ["ALLOW", "ALLOW", "ALLOW", "DENY", "REQUIRE_APPROVAL", "DENY"],
  );
  assert.deepEqual(demo.decisions[3]?.reasonCodes, ["TRANSACTION_LIMIT_EXCEEDED"]);
  assert.deepEqual(demo.decisions[4]?.reasonCodes, ["UNKNOWN_MERCHANT"]);
  assert.deepEqual(demo.decisions[5]?.reasonCodes, ["RECIPIENT_NOT_ALLOWED"]);
  assert.equal(demo.totals.attemptedBaseUnits, 518_550_000n);
  assert.equal(demo.totals.authorizedBaseUnits, 550_000n);
  assert.equal(demo.totals.blockedBaseUnits, 514_000_000n);
  assert.equal(demo.totals.pendingApprovalBaseUnits, 4_000_000n);
  assert.equal(demo.blastRadius.unrestrictedExposureBaseUnits, 10_000_000_000n);
  assert.equal(demo.blastRadius.policyConstrained.currentTaskExposureBaseUnits, 3_000_000n);
  assert.equal(demo.blastRadius.policyConstrained.effectiveMaximumAuthorizedExposureBaseUnits, 20_000_000n);
  assert.equal(demo.blastRadius.reductionBps, 9_980);
  assert.equal(demo.currentBlastRadius.currentTaskExposureBaseUnits, 2_450_000n);
  assert.ok(demo.policyRecommendation.explanations.every((item) => item.findingIds.length > 0));
});
