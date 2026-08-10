import type { RiskFinding } from "./domain.js";

export interface AgentFinancialCapabilities {
  readonly maxTransactionBaseUnits?: bigint;
  readonly taskBudgetBaseUnits?: bigint;
  readonly maxRetries?: number;
  readonly allowedMerchants?: readonly string[];
  readonly allowedRecipients?: readonly string[];
  readonly maxPaidCallsPerTask?: number;
  readonly priceDeviationGuardBps?: number;
  readonly maxHourlySpendBaseUnits?: bigint;
}

export interface CapabilityAnalysis {
  readonly agentId: string;
  readonly findings: readonly RiskFinding[];
}

interface CapabilityRisk {
  readonly id: string;
  readonly category: string;
  readonly description: string;
  readonly impact: bigint;
  readonly recommendation: string;
  readonly missing: (capabilities: AgentFinancialCapabilities) => boolean;
}

const RISKS: readonly CapabilityRisk[] = [
  {
    id: "NO_TRANSACTION_LIMIT",
    category: "NO_TRANSACTION_LIMIT",
    description: "The agent has no maximum amount for a single paid action.",
    impact: 10_000_000_000n,
    recommendation: "Set maxTransactionBaseUnits to 2000000 (US$2).",
    missing: (capabilities) => capabilities.maxTransactionBaseUnits === undefined,
  },
  {
    id: "NO_TASK_BUDGET",
    category: "NO_TASK_BUDGET",
    description: "The agent has no financial budget bound to the current task.",
    impact: 10_000_000_000n,
    recommendation: "Set taskBudgetBaseUnits to 3000000 (US$3).",
    missing: (capabilities) => capabilities.taskBudgetBaseUnits === undefined,
  },
  {
    id: "UNLIMITED_RETRIES",
    category: "UNLIMITED_RETRIES",
    description: "Paid retries have no deterministic cap.",
    impact: 32_520_000n,
    recommendation: "Set maxRetries to 3.",
    missing: (capabilities) => capabilities.maxRetries === undefined,
  },
  {
    id: "UNRESTRICTED_MERCHANTS",
    category: "UNRESTRICTED_MERCHANTS",
    description: "The agent may use merchants that were not reviewed.",
    impact: 4_000_000n,
    recommendation: "Require approval for unknown merchants above US$0.50.",
    missing: (capabilities) => capabilities.allowedMerchants === undefined,
  },
  {
    id: "UNRESTRICTED_RECIPIENTS",
    category: "UNRESTRICTED_RECIPIENTS",
    description: "The agent may send funds to recipients that were not approved.",
    impact: 500_000_000n,
    recommendation: "Deny unknown recipients.",
    missing: (capabilities) => capabilities.allowedRecipients === undefined,
  },
  {
    id: "RUNAWAY_LOOP_RISK",
    category: "RUNAWAY_LOOP_RISK",
    description: "Paid tool calls have no finite task-level execution cap.",
    impact: 100_000_000n,
    recommendation: "Set maxPaidCallsPerTask to 100.",
    missing: (capabilities) => capabilities.maxPaidCallsPerTask === undefined,
  },
  {
    id: "PRICE_SPIKE_RISK",
    category: "PRICE_SPIKE_RISK",
    description: "The agent has no price deviation guard for paid requests.",
    impact: 5_000_000n,
    recommendation: "Reject requests above the approved price deviation baseline.",
    missing: (capabilities) => capabilities.priceDeviationGuardBps === undefined,
  },
  {
    id: "ABNORMAL_SPENDING_VELOCITY",
    category: "ABNORMAL_SPENDING_VELOCITY",
    description: "The agent has no hourly financial velocity boundary.",
    impact: 100_000_000n,
    recommendation: "Set an hourly spend limit and reserve it atomically.",
    missing: (capabilities) => capabilities.maxHourlySpendBaseUnits === undefined,
  },
];

export function analyzeFinancialCapabilities(
  agentId: string,
  capabilities: AgentFinancialCapabilities,
): CapabilityAnalysis {
  return {
    agentId,
    findings: RISKS.filter((risk) => risk.missing(capabilities)).map((risk) => ({
      schemaVersion: "agentsafe.risk-finding.v1" as const,
      id: `${agentId}:${risk.id}`,
      agentId,
      scenario: "CAPABILITY_ANALYSIS",
      category: risk.category,
      severity: risk.impact >= 100_000_000n ? "CRITICAL" : "HIGH",
      confidence: 1,
      description: risk.description,
      trigger: { source: "OBSERVED_CAPABILITY", missingControl: risk.id },
      financialImpactBaseUnits: risk.impact,
      estimatedMaxLossBaseUnits: risk.impact,
      toolsInvolved: [],
      suggestedMitigations: [risk.recommendation],
      evidence: [{ observed: "control_absent", control: risk.id }],
    })),
  };
}
