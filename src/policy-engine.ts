import type {
  EvaluationInput,
  PolicyDecision,
  ReasonCode,
} from "./domain.js";
import { remaining, wouldExceed } from "./money.js";

const REASON_TEXT: Readonly<Record<ReasonCode, string>> = {
  INVALID_INTENT: "The payment intent or financial context is invalid.",
  UNSUPPORTED_TOKEN: "The requested token is not authorized by this policy.",
  UNSUPPORTED_CHAIN: "The requested chain is not authorized by this policy.",
  NETWORK_MISMATCH: "The request network does not match the active policy.",
  AGENT_FROZEN: "The agent is frozen and cannot receive new financial authorization.",
  POLICY_NOT_ACTIVE: "The selected policy version is not active.",
  POLICY_NOT_EFFECTIVE: "The selected policy version is not effective yet.",
  POLICY_EXPIRED: "The selected policy version has expired.",
  TASK_EXPIRED: "The task budget has expired.",
  ALLOWANCE_EXPIRED: "The onchain allowance has expired.",
  TRANSACTION_LIMIT_EXCEEDED: "The request exceeds the per-transaction limit.",
  TASK_BUDGET_EXCEEDED: "The request exceeds the remaining task budget.",
  HOURLY_LIMIT_EXCEEDED: "The request exceeds the remaining hourly budget.",
  DAILY_LIMIT_EXCEEDED: "The request exceeds the remaining daily budget.",
  WEEKLY_LIMIT_EXCEEDED: "The request exceeds the remaining weekly budget.",
  LIFETIME_LIMIT_EXCEEDED: "The request exceeds the remaining lifetime allowance.",
  UNKNOWN_MERCHANT: "The merchant is not known or allowlisted.",
  DENIED_MERCHANT: "The merchant is explicitly denied.",
  UNKNOWN_RECIPIENT: "The recipient is not known or allowlisted.",
  RECIPIENT_NOT_ALLOWED: "The recipient is not present in the policy allowlist.",
  SERVICE_CATEGORY_NOT_ALLOWED: "The requested service category is not allowed.",
  PRICE_SPIKE: "The request exceeds the configured historical price deviation.",
  RETRY_LIMIT: "The request exceeds the maximum retry count.",
  PAID_CALL_LIMIT: "The task has reached its maximum number of paid calls.",
  INSUFFICIENT_ALLOWANCE: "The onchain allowance is smaller than the requested amount.",
  APPROVAL_REQUIRED: "This exceptional payment requires a one-time human approval.",
};

function min(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

function normalized(value: string | undefined): string | undefined {
  const result = value?.trim().toLowerCase();
  return result ? result : undefined;
}

function validDate(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function hasInvalidFinancialContext(input: EvaluationInput): boolean {
  const { intent, task, history, allowance, policy } = input;
  const money = [
    intent.amountBaseUnits,
    task.approvedBudgetBaseUnits,
    task.spentBaseUnits,
    task.reservedBaseUnits,
    history.hourlySpentBaseUnits,
    history.hourlyReservedBaseUnits,
    history.dailySpentBaseUnits,
    history.dailyReservedBaseUnits,
    history.weeklySpentBaseUnits,
    history.weeklyReservedBaseUnits,
    history.lifetimeSpentBaseUnits,
    history.lifetimeReservedBaseUnits,
    allowance.remainingBaseUnits,
    policy.rules.maxTransactionBaseUnits,
    policy.rules.maxTaskBaseUnits,
    policy.rules.maxHourlyBaseUnits,
    policy.rules.maxDailyBaseUnits,
    policy.rules.newMerchantApprovalThresholdBaseUnits,
  ];
  if (policy.rules.maxWeeklyBaseUnits !== undefined) money.push(policy.rules.maxWeeklyBaseUnits);
  if (policy.rules.maxLifetimeBaseUnits !== undefined) money.push(policy.rules.maxLifetimeBaseUnits);
  if (history.medianPriceBaseUnits !== undefined) money.push(history.medianPriceBaseUnits);

  return (
    typeof intent.amountBaseUnits !== "bigint" ||
    intent.amountBaseUnits <= 0n ||
    money.some((value) => typeof value !== "bigint" || value < 0n) ||
    !Number.isInteger(intent.retryAttempt) ||
    intent.retryAttempt < 0 ||
    !Number.isInteger(history.paidCallsForTask) ||
    history.paidCallsForTask < 0 ||
    !Number.isInteger(policy.rules.maxRetries) ||
    policy.rules.maxRetries < 0 ||
    !Number.isInteger(policy.rules.maxPaidCallsPerTask) ||
    policy.rules.maxPaidCallsPerTask < 0 ||
    !Number.isInteger(policy.rules.maxPriceDeviationBps) ||
    policy.rules.maxPriceDeviationBps < 10_000 ||
    !intent.id ||
    !intent.workspaceId ||
    !intent.agentId ||
    !intent.taskId ||
    !intent.recipient ||
    validDate(input.now) === null ||
    validDate(intent.requestedAt) === null ||
    validDate(policy.effectiveFrom) === null
  );
}

function buildDecision(
  input: EvaluationInput,
  decision: PolicyDecision["decision"],
  reasonCodes: readonly ReasonCode[],
  matchedRuleIds: readonly string[],
  riskSignals: readonly string[],
): PolicyDecision {
  const taskLimit = min(input.task.approvedBudgetBaseUnits, input.policy.rules.maxTaskBaseUnits);
  const reserve = decision === "ALLOW" ? input.intent.amountBaseUnits : 0n;
  const result: PolicyDecision = {
    decision,
    reasonCodes,
    humanReadableExplanation:
      reasonCodes.length === 0
        ? "The request is within every evaluated financial boundary."
        : reasonCodes.map((code) => REASON_TEXT[code]).join(" "),
    matchedRuleIds,
    riskSignals,
    policyVersionId: input.policy.versionId,
    remainingTaskBudgetBaseUnits: remaining(
      taskLimit,
      input.task.spentBaseUnits,
      input.task.reservedBaseUnits + reserve,
    ),
    remainingDailyBudgetBaseUnits: remaining(
      input.policy.rules.maxDailyBaseUnits,
      input.history.dailySpentBaseUnits,
      input.history.dailyReservedBaseUnits + reserve,
    ),
    ...(decision === "ALLOW" ? { reservationAmountBaseUnits: input.intent.amountBaseUnits } : {}),
  };
  return result;
}

function deny(
  input: EvaluationInput,
  code: ReasonCode,
  ruleId: string,
  riskSignals: readonly string[] = [],
): PolicyDecision {
  return buildDecision(input, "DENY", [code], [ruleId], riskSignals);
}

/**
 * Pure deterministic evaluation. It proposes a reservation but never mutates
 * counters; the application service must persist the decision and reservation
 * in one database transaction before returning ALLOW to an agent.
 */
export function evaluatePayment(input: EvaluationInput): PolicyDecision {
  if (hasInvalidFinancialContext(input)) {
    return deny(input, "INVALID_INTENT", "intent.valid");
  }

  const now = validDate(input.now)!;
  const policyEffectiveFrom = validDate(input.policy.effectiveFrom)!;
  const { intent, policy, task, history, allowance } = input;
  const rules = policy.rules;

  if (intent.token !== policy.token) return deny(input, "UNSUPPORTED_TOKEN", "policy.token");
  if (intent.chain !== policy.chain) return deny(input, "UNSUPPORTED_CHAIN", "policy.chain");
  if (intent.network !== policy.network) return deny(input, "NETWORK_MISMATCH", "policy.network");
  if (input.agent.status === "FROZEN") return deny(input, "AGENT_FROZEN", "agent.status");
  if (policy.status !== "ACTIVE") return deny(input, "POLICY_NOT_ACTIVE", "policy.status");
  if (now < policyEffectiveFrom) return deny(input, "POLICY_NOT_EFFECTIVE", "policy.effectiveFrom");
  if (policy.expiresAt !== undefined) {
    const expiresAt = validDate(policy.expiresAt);
    if (expiresAt === null) return deny(input, "INVALID_INTENT", "policy.expiresAt");
    if (now >= expiresAt) return deny(input, "POLICY_EXPIRED", "policy.expiresAt");
  }
  if (task.expiresAt !== undefined) {
    const expiresAt = validDate(task.expiresAt);
    if (expiresAt === null) return deny(input, "INVALID_INTENT", "task.expiresAt");
    if (now >= expiresAt) return deny(input, "TASK_EXPIRED", "task.expiresAt");
  }
  if (allowance.expiresAt !== undefined) {
    const expiresAt = validDate(allowance.expiresAt);
    if (expiresAt === null) return deny(input, "INVALID_INTENT", "allowance.expiresAt");
    if (now >= expiresAt) return deny(input, "ALLOWANCE_EXPIRED", "allowance.expiresAt");
  }

  const merchant = normalized(intent.merchant);
  const deniedMerchants = new Set(rules.deniedMerchants.map((item) => normalized(item)));
  const allowedMerchants = new Set(rules.allowedMerchants.map((item) => normalized(item)));
  if (merchant !== undefined && deniedMerchants.has(merchant)) {
    return deny(input, "DENIED_MERCHANT", "merchant.denylist", ["denied-merchant"]);
  }

  if (
    rules.allowedServiceCategories !== undefined &&
    (!intent.serviceCategory ||
      !new Set(rules.allowedServiceCategories.map((item) => normalized(item))).has(normalized(intent.serviceCategory)))
  ) {
    return deny(input, "SERVICE_CATEGORY_NOT_ALLOWED", "service-category.allowlist");
  }

  const approvalReasons: ReasonCode[] = [];
  const approvalRules: string[] = [];
  const approvalSignals: string[] = [];

  const merchantAllowed = merchant !== undefined && allowedMerchants.has(merchant);
  if (!merchantAllowed) {
    if (rules.unknownMerchantAction === "DENY") {
      return deny(input, "UNKNOWN_MERCHANT", "merchant.unknown", ["unknown-merchant"]);
    }
    if (rules.unknownMerchantAction === "REQUIRE_APPROVAL") {
      approvalReasons.push("UNKNOWN_MERCHANT");
      approvalRules.push("merchant.unknown");
      approvalSignals.push("unknown-merchant");
    }
  }
  if (
    merchantAllowed &&
    !history.merchantSeen &&
    intent.amountBaseUnits > rules.newMerchantApprovalThresholdBaseUnits
  ) {
    approvalReasons.push("APPROVAL_REQUIRED");
    approvalRules.push("merchant.first-purchase-threshold");
    approvalSignals.push("new-merchant");
  }

  const recipientAllowed = rules.allowedRecipients.includes(intent.recipient);
  if (!recipientAllowed) {
    const code: ReasonCode = rules.allowedRecipients.length > 0 ? "RECIPIENT_NOT_ALLOWED" : "UNKNOWN_RECIPIENT";
    if (rules.unknownRecipientAction === "DENY") {
      return deny(input, code, "recipient.allowlist", ["unknown-recipient"]);
    }
    if (rules.unknownRecipientAction === "REQUIRE_APPROVAL") {
      approvalReasons.push(code);
      approvalRules.push("recipient.allowlist");
      approvalSignals.push("unknown-recipient");
    }
  }

  // An approval is not an authorization to spend. Return it before financial
  // caps so an operator can review a novel merchant as a deliberate exception;
  // any approved execution must be re-evaluated and hash-bound downstream.
  if (approvalReasons.length > 0) {
    return buildDecision(input, "REQUIRE_APPROVAL", approvalReasons, approvalRules, approvalSignals);
  }

  if (intent.amountBaseUnits > rules.maxTransactionBaseUnits) {
    return deny(input, "TRANSACTION_LIMIT_EXCEEDED", "spend.per-transaction", ["oversized-transaction"]);
  }

  const taskLimit = min(task.approvedBudgetBaseUnits, rules.maxTaskBaseUnits);
  if (wouldExceed(taskLimit, task.spentBaseUnits, task.reservedBaseUnits, intent.amountBaseUnits)) {
    return deny(input, "TASK_BUDGET_EXCEEDED", "spend.task", ["task-budget-overrun"]);
  }
  if (
    wouldExceed(
      rules.maxHourlyBaseUnits,
      history.hourlySpentBaseUnits,
      history.hourlyReservedBaseUnits,
      intent.amountBaseUnits,
    )
  ) {
    return deny(input, "HOURLY_LIMIT_EXCEEDED", "spend.hourly", ["high-spending-velocity"]);
  }
  if (
    wouldExceed(
      rules.maxDailyBaseUnits,
      history.dailySpentBaseUnits,
      history.dailyReservedBaseUnits,
      intent.amountBaseUnits,
    )
  ) {
    return deny(input, "DAILY_LIMIT_EXCEEDED", "spend.daily", ["daily-budget-overrun"]);
  }
  if (
    rules.maxWeeklyBaseUnits !== undefined &&
    wouldExceed(
      rules.maxWeeklyBaseUnits,
      history.weeklySpentBaseUnits,
      history.weeklyReservedBaseUnits,
      intent.amountBaseUnits,
    )
  ) {
    return deny(input, "WEEKLY_LIMIT_EXCEEDED", "spend.weekly");
  }
  if (
    rules.maxLifetimeBaseUnits !== undefined &&
    wouldExceed(
      rules.maxLifetimeBaseUnits,
      history.lifetimeSpentBaseUnits,
      history.lifetimeReservedBaseUnits,
      intent.amountBaseUnits,
    )
  ) {
    return deny(input, "LIFETIME_LIMIT_EXCEEDED", "spend.lifetime");
  }
  if (intent.amountBaseUnits > allowance.remainingBaseUnits) {
    return deny(input, "INSUFFICIENT_ALLOWANCE", "allowance.remaining");
  }
  if (intent.retryAttempt > rules.maxRetries) {
    return deny(input, "RETRY_LIMIT", "operations.max-retries", ["retry-limit-exceeded"]);
  }
  if (history.paidCallsForTask >= rules.maxPaidCallsPerTask) {
    return deny(input, "PAID_CALL_LIMIT", "operations.max-paid-calls", ["paid-call-fanout"]);
  }
  if (
    history.medianPriceBaseUnits !== undefined &&
    history.medianPriceBaseUnits > 0n &&
    intent.amountBaseUnits * 10_000n > history.medianPriceBaseUnits * BigInt(rules.maxPriceDeviationBps)
  ) {
    return deny(input, "PRICE_SPIKE", "price.max-deviation", ["price-spike"]);
  }

  return buildDecision(
    input,
    "ALLOW",
    [],
    [
      "spend.per-transaction",
      "spend.task",
      "spend.hourly",
      "spend.daily",
      "merchant.policy",
      "recipient.policy",
      "allowance.remaining",
    ],
    [],
  );
}
