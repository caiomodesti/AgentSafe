import { pathToFileURL } from "node:url";
import { compareBlastRadius, calculateBlastRadius } from "../blast-radius.js";
import { analyzeFinancialCapabilities } from "../capability-analysis.js";
import type { EvaluationInput, PaymentIntent, PolicyDecision, RiskFinding } from "../domain.js";
import { evaluatePayment } from "../policy-engine.js";
import { generateSafePolicy } from "../policy-generator.js";
import { calculateAgentFinancialRiskScore } from "../risk-score.js";
import { LocalSimulationProvider } from "../simulation.js";

const NOW = "2026-08-06T12:00:00.000Z";
const TREASURY_BASE_UNITS = 10_000_000_000n;
const SAFE_RECIPIENT = "ResearchServices111111111111111111111111111";

export interface ResearchBotDecisionEvent {
  readonly label: string;
  readonly intent: PaymentIntent;
  readonly decision: PolicyDecision;
}

export interface ResearchBotDemo {
  readonly environment: "SIMULATED";
  readonly task: string;
  readonly riskScore: ReturnType<typeof calculateAgentFinancialRiskScore>;
  readonly riskFindings: readonly RiskFinding[];
  readonly simulationSummary: {
    readonly total: number;
    readonly safe: number;
    readonly risksDetected: number;
  };
  readonly policyRecommendation: ReturnType<typeof generateSafePolicy>;
  readonly timeline: readonly ResearchBotDecisionEvent[];
  readonly decisions: readonly PolicyDecision[];
  readonly totals: {
    readonly attemptedBaseUnits: bigint;
    readonly authorizedBaseUnits: bigint;
    readonly blockedBaseUnits: bigint;
    readonly pendingApprovalBaseUnits: bigint;
  };
  /** Comparison at policy activation, before the ResearchBot executes calls. */
  readonly blastRadius: ReturnType<typeof compareBlastRadius>;
  /** Remaining authority after the allowed calls in this demo. */
  readonly currentBlastRadius: ReturnType<typeof calculateBlastRadius>;
}

export function runResearchBotDemo(): ResearchBotDemo {
  // This is the observed starting state. No operator enters limits manually.
  const capabilityAnalysis = analyzeFinancialCapabilities("researchbot", {});
  const simulation = new LocalSimulationProvider().simulateAgent({
    agentId: "researchbot",
    taskId: "market-report-2026-08-06",
    controls: {
      unknownMerchantBlocked: false,
      unknownRecipientBlocked: false,
      promptTriggeredPaymentsBlocked: false,
    },
  });

  const riskScore = calculateAgentFinancialRiskScore({
    unrestrictedProviderDiscovery: true,
    unlimitedRetries: true,
    unknownRecipientsAllowed: true,
    unlimitedTaskBudget: true,
    highToolFanout: false,
    unboundedSubagents: false,
    noPerTransactionLimit: true,
    noDailyLimit: true,
    priceBaselineMissing: true,
    allowanceWithoutExpiration: false,
  });

  const policyRecommendation = generateSafePolicy({
    successfulRequestP96BaseUnits: 1_140_000n,
    expectedTaskCostBaseUnits: 800_000n,
    findings: capabilityAnalysis.findings,
    verifiedMerchants: ["Tavily", "Gemini", "BigQuery"],
    verifiedRecipients: [SAFE_RECIPIENT],
  });

  const blastRadius = compareBlastRadius(TREASURY_BASE_UNITS, {
    treasuryAvailableBaseUnits: TREASURY_BASE_UNITS,
    perTransactionRemainingBaseUnits: policyRecommendation.rules.maxTransactionBaseUnits,
    taskRemainingBaseUnits: policyRecommendation.rules.maxTaskBaseUnits,
    dailyRemainingBaseUnits: policyRecommendation.rules.maxDailyBaseUnits,
    lifetimeRemainingBaseUnits: 200_000_000n,
    onchainRemainingAllowanceBaseUnits: 20_000_000n,
  });

  let taskSpent = 0n;
  let dailySpent = 0n;
  const evaluate = (intent: PaymentIntent, merchantSeen = true): PolicyDecision => {
    const decision = evaluatePayment({
      now: NOW,
      intent,
      agent: { status: "ACTIVE" },
      task: {
        approvedBudgetBaseUnits: policyRecommendation.rules.maxTaskBaseUnits,
        spentBaseUnits: taskSpent,
        reservedBaseUnits: 0n,
        expiresAt: "2026-08-13T12:00:00.000Z",
      },
      history: {
        hourlySpentBaseUnits: dailySpent,
        hourlyReservedBaseUnits: 0n,
        dailySpentBaseUnits: dailySpent,
        dailyReservedBaseUnits: 0n,
        weeklySpentBaseUnits: dailySpent,
        weeklyReservedBaseUnits: 0n,
        lifetimeSpentBaseUnits: dailySpent,
        lifetimeReservedBaseUnits: 0n,
        merchantSeen,
        medianPriceBaseUnits: intent.amountBaseUnits,
        paidCallsForTask: 0,
      },
      allowance: {
        remainingBaseUnits: 20_000_000n - dailySpent,
        expiresAt: "2026-08-13T12:00:00.000Z",
      },
      policy: {
        id: "researchbot-safe-policy",
        versionId: "researchbot-safe-policy-v1",
        version: 1,
        status: "ACTIVE",
        chain: "SOLANA",
        network: "DEVNET",
        token: "USDC",
        effectiveFrom: "2026-08-06T00:00:00.000Z",
        expiresAt: "2026-08-13T12:00:00.000Z",
        rules: policyRecommendation.rules,
      },
    });
    if (decision.decision === "ALLOW") {
      taskSpent += intent.amountBaseUnits;
      dailySpent += intent.amountBaseUnits;
    }
    return decision;
  };

  const intent = (
    id: string,
    amountBaseUnits: bigint,
    merchant: string,
    recipient = SAFE_RECIPIENT,
  ): PaymentIntent => ({
    id,
    workspaceId: "demo-workspace",
    agentId: "researchbot",
    taskId: "market-report-2026-08-06",
    amountBaseUnits,
    token: "USDC",
    chain: "SOLANA",
    network: "DEVNET",
    merchant,
    recipient,
    serviceCategory: "data",
    tool: "research-provider",
    retryAttempt: 0,
    requestedAt: NOW,
    metadata: { environment: "SIMULATED" },
  });

  const requested = [
    ["Search API", intent("search-api", 60_000n, "Tavily"), true],
    ["LLM", intent("llm", 310_000n, "Gemini"), true],
    ["Dataset", intent("dataset", 180_000n, "BigQuery"), true],
    ["Premium Dataset", intent("premium-dataset", 14_000_000n, "BigQuery"), true],
    ["Unknown merchant", intent("unknown-merchant", 4_000_000n, "NewProvider"), false],
    [
      "Unknown recipient",
      intent("unknown-recipient", 500_000_000n, "Tavily", "UnknownRecipient"),
      true,
    ],
  ] as const;
  const timeline = requested.map(([label, paymentIntent, merchantSeen]) => ({
    label,
    intent: paymentIntent,
    decision: evaluate(paymentIntent, merchantSeen),
  }));
  const decisions = timeline.map((event) => event.decision);
  const attemptedBaseUnits = timeline.reduce((total, event) => total + event.intent.amountBaseUnits, 0n);
  const authorizedBaseUnits = timeline
    .filter((event) => event.decision.decision === "ALLOW")
    .reduce((total, event) => total + event.intent.amountBaseUnits, 0n);
  const blockedBaseUnits = timeline
    .filter((event) => event.decision.decision === "DENY")
    .reduce((total, event) => total + event.intent.amountBaseUnits, 0n);
  const pendingApprovalBaseUnits = timeline
    .filter((event) => event.decision.decision === "REQUIRE_APPROVAL")
    .reduce((total, event) => total + event.intent.amountBaseUnits, 0n);

  return {
    environment: "SIMULATED",
    task: "Analyze 50 AI startups and generate a market report.",
    riskScore,
    riskFindings: capabilityAnalysis.findings,
    simulationSummary: {
      total: simulation.scenarios.length,
      safe: simulation.scenarios.filter((scenario) => scenario.finalStatus === "SAFE").length,
      risksDetected: simulation.findings.length,
    },
    policyRecommendation,
    timeline,
    decisions,
    totals: { attemptedBaseUnits, authorizedBaseUnits, blockedBaseUnits, pendingApprovalBaseUnits },
    blastRadius,
    currentBlastRadius: calculateBlastRadius({
      treasuryAvailableBaseUnits: TREASURY_BASE_UNITS,
      perTransactionRemainingBaseUnits: policyRecommendation.rules.maxTransactionBaseUnits,
      taskRemainingBaseUnits: policyRecommendation.rules.maxTaskBaseUnits - taskSpent,
      dailyRemainingBaseUnits: policyRecommendation.rules.maxDailyBaseUnits - dailySpent,
      lifetimeRemainingBaseUnits: 200_000_000n - dailySpent,
      onchainRemainingAllowanceBaseUnits: 20_000_000n - dailySpent,
    }),
  };
}

function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString(10) : item), 2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${serialize(runResearchBotDemo())}\n`);
}
