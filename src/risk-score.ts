export type RiskLevel = "LOW" | "MODERATE" | "ELEVATED" | "HIGH" | "CRITICAL";

export interface AgentRiskProfile {
  readonly unrestrictedProviderDiscovery: boolean;
  readonly unlimitedRetries: boolean;
  readonly unknownRecipientsAllowed: boolean;
  readonly unlimitedTaskBudget: boolean;
  readonly highToolFanout: boolean;
  readonly unboundedSubagents: boolean;
  readonly noPerTransactionLimit: boolean;
  readonly noDailyLimit: boolean;
  readonly priceBaselineMissing: boolean;
  readonly allowanceWithoutExpiration: boolean;
}

export interface RiskContributor {
  readonly code: keyof AgentRiskProfile;
  readonly points: number;
  readonly explanation: string;
}

export interface AgentFinancialRiskScore {
  /** Relative internal risk index, explicitly not a probability of loss. */
  readonly score: number;
  readonly level: RiskLevel;
  readonly contributors: readonly RiskContributor[];
}

const WEIGHTS: Readonly<Record<keyof AgentRiskProfile, Omit<RiskContributor, "code">>> = {
  unrestrictedProviderDiscovery: { points: 15, explanation: "Provider discovery is unrestricted." },
  unlimitedRetries: { points: 12, explanation: "Paid retries do not have a deterministic cap." },
  unknownRecipientsAllowed: { points: 10, explanation: "Unknown recipients may receive funds." },
  unlimitedTaskBudget: { points: 15, explanation: "Tasks have no purpose-bound financial budget." },
  highToolFanout: { points: 8, explanation: "The agent can fan out across many paid tools." },
  unboundedSubagents: { points: 12, explanation: "Subagents can multiply paid activity without a cap." },
  noPerTransactionLimit: { points: 10, explanation: "No per-transaction maximum is configured." },
  noDailyLimit: { points: 10, explanation: "No daily spending maximum is configured." },
  priceBaselineMissing: { points: 6, explanation: "Price deviation cannot be measured without a baseline." },
  allowanceWithoutExpiration: { points: 5, explanation: "Delegated authority has no expiration." },
};

export function riskLevel(score: number): RiskLevel {
  if (score <= 20) return "LOW";
  if (score <= 40) return "MODERATE";
  if (score <= 60) return "ELEVATED";
  if (score <= 80) return "HIGH";
  return "CRITICAL";
}

export function calculateAgentFinancialRiskScore(profile: AgentRiskProfile): AgentFinancialRiskScore {
  const contributors = (Object.keys(WEIGHTS) as Array<keyof AgentRiskProfile>)
    .filter((code) => profile[code])
    .map((code) => ({ code, ...WEIGHTS[code] }));
  const score = Math.min(100, contributors.reduce((sum, item) => sum + item.points, 0));
  return { score, level: riskLevel(score), contributors };
}

