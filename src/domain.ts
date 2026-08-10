export type Chain = "SOLANA";
export type Network = "DEVNET" | "MAINNET";
export type Token = "USDC";
export type AgentStatus = "ACTIVE" | "FROZEN";
export type PolicyStatus = "DRAFT" | "ACTIVE" | "RETIRED";
export type PolicyResult = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";
export type ExceptionalAction = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export interface PaymentIntent {
  readonly id: string;
  readonly workspaceId: string;
  readonly agentId: string;
  readonly taskId: string;
  readonly amountBaseUnits: bigint;
  readonly token: Token;
  readonly chain: Chain;
  readonly network: Network;
  readonly merchant?: string;
  readonly recipient: string;
  readonly serviceCategory?: string;
  readonly tool?: string;
  /** Zero is the initial request. Values above zero are retries. */
  readonly retryAttempt: number;
  readonly requestedAt: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface AgentContext {
  readonly status: AgentStatus;
}

export interface TaskContext {
  readonly approvedBudgetBaseUnits: bigint;
  readonly spentBaseUnits: bigint;
  readonly reservedBaseUnits: bigint;
  readonly expiresAt?: string;
}

export interface HistoricalContext {
  readonly hourlySpentBaseUnits: bigint;
  readonly hourlyReservedBaseUnits: bigint;
  readonly dailySpentBaseUnits: bigint;
  readonly dailyReservedBaseUnits: bigint;
  readonly weeklySpentBaseUnits: bigint;
  readonly weeklyReservedBaseUnits: bigint;
  readonly lifetimeSpentBaseUnits: bigint;
  readonly lifetimeReservedBaseUnits: bigint;
  readonly merchantSeen: boolean;
  readonly medianPriceBaseUnits?: bigint;
  readonly paidCallsForTask: number;
}

export interface AllowanceContext {
  readonly remainingBaseUnits: bigint;
  readonly expiresAt?: string;
}

export interface PolicyRules {
  readonly maxTransactionBaseUnits: bigint;
  readonly maxTaskBaseUnits: bigint;
  readonly maxHourlyBaseUnits: bigint;
  readonly maxDailyBaseUnits: bigint;
  readonly maxWeeklyBaseUnits?: bigint;
  readonly maxLifetimeBaseUnits?: bigint;
  readonly allowedMerchants: readonly string[];
  readonly deniedMerchants: readonly string[];
  readonly allowedRecipients: readonly string[];
  readonly unknownMerchantAction: ExceptionalAction;
  readonly unknownRecipientAction: ExceptionalAction;
  readonly newMerchantApprovalThresholdBaseUnits: bigint;
  /** 30_000 means 300% of the historical median. */
  readonly maxPriceDeviationBps: number;
  readonly maxRetries: number;
  readonly maxPaidCallsPerTask: number;
  readonly allowedServiceCategories?: readonly string[];
}

export interface Policy {
  readonly id: string;
  readonly versionId: string;
  readonly version: number;
  readonly status: PolicyStatus;
  readonly chain: Chain;
  readonly network: Network;
  readonly token: Token;
  readonly effectiveFrom: string;
  readonly expiresAt?: string;
  readonly rules: PolicyRules;
}

export interface EvaluationInput {
  readonly now: string;
  readonly intent: PaymentIntent;
  readonly agent: AgentContext;
  readonly task: TaskContext;
  readonly history: HistoricalContext;
  readonly allowance: AllowanceContext;
  readonly policy: Policy;
}

export type ReasonCode =
  | "INVALID_INTENT"
  | "UNSUPPORTED_TOKEN"
  | "UNSUPPORTED_CHAIN"
  | "NETWORK_MISMATCH"
  | "AGENT_FROZEN"
  | "POLICY_NOT_ACTIVE"
  | "POLICY_NOT_EFFECTIVE"
  | "POLICY_EXPIRED"
  | "TASK_EXPIRED"
  | "ALLOWANCE_EXPIRED"
  | "TRANSACTION_LIMIT_EXCEEDED"
  | "TASK_BUDGET_EXCEEDED"
  | "HOURLY_LIMIT_EXCEEDED"
  | "DAILY_LIMIT_EXCEEDED"
  | "WEEKLY_LIMIT_EXCEEDED"
  | "LIFETIME_LIMIT_EXCEEDED"
  | "UNKNOWN_MERCHANT"
  | "DENIED_MERCHANT"
  | "UNKNOWN_RECIPIENT"
  | "RECIPIENT_NOT_ALLOWED"
  | "SERVICE_CATEGORY_NOT_ALLOWED"
  | "PRICE_SPIKE"
  | "RETRY_LIMIT"
  | "PAID_CALL_LIMIT"
  | "INSUFFICIENT_ALLOWANCE"
  | "APPROVAL_REQUIRED";

export interface PolicyDecision {
  readonly decision: PolicyResult;
  readonly reasonCodes: readonly ReasonCode[];
  readonly humanReadableExplanation: string;
  readonly matchedRuleIds: readonly string[];
  readonly riskSignals: readonly string[];
  readonly policyVersionId: string;
  readonly remainingTaskBudgetBaseUnits: bigint;
  readonly remainingDailyBudgetBaseUnits: bigint;
  /** Present only for ALLOW; the application layer must reserve this atomically. */
  readonly reservationAmountBaseUnits?: bigint;
}

export interface RiskFinding {
  readonly schemaVersion: "agentsafe.risk-finding.v1";
  readonly id: string;
  readonly agentId: string;
  readonly scenario: string;
  readonly category: string;
  readonly severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Relative confidence in [0, 1], not a probability of loss. */
  readonly confidence: number;
  readonly description: string;
  readonly trigger: Readonly<Record<string, unknown>>;
  readonly financialImpactBaseUnits: bigint;
  readonly estimatedMaxLossBaseUnits: bigint;
  readonly toolsInvolved: readonly string[];
  readonly recipient?: string;
  readonly merchant?: string;
  readonly suggestedMitigations: readonly string[];
  readonly evidence: readonly Readonly<Record<string, unknown>>[];
}

