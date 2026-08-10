import type { PolicyRules, RiskFinding } from "./domain.js";

export interface PolicyGenerationInput {
  readonly successfulRequestP96BaseUnits: bigint;
  readonly expectedTaskCostBaseUnits: bigint;
  readonly findings: readonly RiskFinding[];
  readonly verifiedMerchants: readonly string[];
  readonly verifiedRecipients: readonly string[];
}

export interface PolicyExplanation {
  readonly ruleId: string;
  readonly reason: string;
  readonly evidence: readonly string[];
  /** Findings that caused or strengthened this recommendation. */
  readonly findingIds: readonly string[];
}

export interface PolicyRecommendation {
  readonly status: "DRAFT";
  readonly generatedBy: "DETERMINISTIC_V1";
  readonly rules: PolicyRules;
  readonly explanations: readonly PolicyExplanation[];
}

function roundUp(value: bigint, increment: bigint): bigint {
  return ((value + increment - 1n) / increment) * increment;
}

function max(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}

function hasScenario(findings: readonly RiskFinding[], scenario: string): boolean {
  return findings.some((finding) => finding.scenario === scenario);
}

function findingsFor(input: readonly RiskFinding[], categories: readonly string[]): readonly string[] {
  return input
    .filter((finding) => categories.includes(finding.category) || categories.includes(finding.scenario))
    .map((finding) => finding.id);
}

export function generateSafePolicy(input: PolicyGenerationInput): PolicyRecommendation {
  if (input.successfulRequestP96BaseUnits <= 0n || input.expectedTaskCostBaseUnits <= 0n) {
    throw new RangeError("cost baselines must be greater than zero");
  }

  // 75% headroom over p96, rounded to 0.10 USDC for operator readability.
  const maxTransactionBaseUnits = roundUp((input.successfulRequestP96BaseUnits * 17_500n) / 10_000n, 100_000n);
  const maxTaskBaseUnits = max(
    maxTransactionBaseUnits,
    roundUp((input.expectedTaskCostBaseUnits * 37_500n) / 10_000n, 100_000n),
  );
  const maxRetries = hasScenario(input.findings, "RETRY_STORM") ? 3 : 5;
  const maxPriceDeviationBps = hasScenario(input.findings, "PRICE_SPIKE") ? 20_000 : 30_000;

  return {
    status: "DRAFT",
    generatedBy: "DETERMINISTIC_V1",
    rules: {
      maxTransactionBaseUnits,
      maxTaskBaseUnits,
      maxHourlyBaseUnits: maxTaskBaseUnits + maxTransactionBaseUnits,
      maxDailyBaseUnits: maxTaskBaseUnits * 6n + maxTransactionBaseUnits,
      maxWeeklyBaseUnits: (maxTaskBaseUnits * 6n + maxTransactionBaseUnits) * 4n,
      allowedMerchants: [...input.verifiedMerchants],
      deniedMerchants: [],
      allowedRecipients: [...input.verifiedRecipients],
      unknownMerchantAction: "REQUIRE_APPROVAL",
      unknownRecipientAction: "DENY",
      newMerchantApprovalThresholdBaseUnits: 500_000n,
      maxPriceDeviationBps,
      maxRetries,
      maxPaidCallsPerTask: 100,
      allowedServiceCategories: ["search", "inference", "data"],
    },
    explanations: [
      {
        ruleId: "spend.per-transaction",
        reason: "Provides measured headroom above successful request cost while bounding a single failure.",
        evidence: [
          `p96 successful request cost: ${input.successfulRequestP96BaseUnits.toString(10)} base units`,
          `recommended cap: ${maxTransactionBaseUnits.toString(10)} base units`,
        ],
        findingIds: findingsFor(input.findings, ["NO_TRANSACTION_LIMIT", "EXPENSIVE_PROVIDER"]),
      },
      {
        ruleId: "spend.task",
        reason: "Binds financial authority to the approved task rather than the full treasury.",
        evidence: [
          `expected task cost: ${input.expectedTaskCostBaseUnits.toString(10)} base units`,
          `recommended task cap: ${maxTaskBaseUnits.toString(10)} base units`,
        ],
        findingIds: findingsFor(input.findings, ["NO_TASK_BUDGET", "BUDGET_OVERRUN"]),
      },
      {
        ruleId: "operations.max-retries",
        reason: hasScenario(input.findings, "RETRY_STORM")
          ? "Simulation found a retry storm with material financial impact."
          : "A finite retry cap prevents an infrastructure failure from becoming unbounded spend.",
        evidence: [`recommended retries: ${maxRetries}`],
        findingIds: findingsFor(input.findings, ["UNLIMITED_RETRIES", "RETRY_STORM"]),
      },
      {
        ruleId: "merchant.unknown",
        reason: "New merchants above the low-risk threshold need explicit operator review.",
        evidence: ["approval threshold: 500000 base units"],
        findingIds: findingsFor(input.findings, ["UNRESTRICTED_MERCHANTS", "UNKNOWN_MERCHANT"]),
      },
      {
        ruleId: "recipient.allowlist",
        reason: "Unknown recipients are blocked because destination changes are security-critical.",
        evidence: [`verified recipients: ${input.verifiedRecipients.length}`],
        findingIds: findingsFor(input.findings, ["UNRESTRICTED_RECIPIENTS", "UNKNOWN_RECIPIENT"]),
      },
    ],
  };
}
