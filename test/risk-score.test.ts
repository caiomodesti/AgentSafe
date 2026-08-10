import assert from "node:assert/strict";
import test from "node:test";
import { calculateAgentFinancialRiskScore, riskLevel } from "../src/risk-score.js";

test("reproduces the explainable 72 HIGH ResearchBot example", () => {
  const result = calculateAgentFinancialRiskScore({
    unrestrictedProviderDiscovery: true,
    unlimitedRetries: true,
    unknownRecipientsAllowed: true,
    unlimitedTaskBudget: true,
    highToolFanout: true,
    unboundedSubagents: true,
    noPerTransactionLimit: false,
    noDailyLimit: false,
    priceBaselineMissing: false,
    allowanceWithoutExpiration: false,
  });

  assert.equal(result.score, 72);
  assert.equal(result.level, "HIGH");
  assert.equal(result.contributors.length, 6);
  assert.equal(result.contributors.reduce((sum, item) => sum + item.points, 0), 72);
});

test("caps the relative index at 100 and respects level boundaries", () => {
  const result = calculateAgentFinancialRiskScore({
    unrestrictedProviderDiscovery: true,
    unlimitedRetries: true,
    unknownRecipientsAllowed: true,
    unlimitedTaskBudget: true,
    highToolFanout: true,
    unboundedSubagents: true,
    noPerTransactionLimit: true,
    noDailyLimit: true,
    priceBaselineMissing: true,
    allowanceWithoutExpiration: true,
  });
  assert.equal(result.score, 100);
  assert.equal(result.level, "CRITICAL");

  assert.equal(riskLevel(20), "LOW");
  assert.equal(riskLevel(21), "MODERATE");
  assert.equal(riskLevel(40), "MODERATE");
  assert.equal(riskLevel(41), "ELEVATED");
  assert.equal(riskLevel(60), "ELEVATED");
  assert.equal(riskLevel(61), "HIGH");
  assert.equal(riskLevel(80), "HIGH");
  assert.equal(riskLevel(81), "CRITICAL");
});

