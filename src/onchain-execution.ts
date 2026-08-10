import type { PaymentIntent, PolicyDecision } from "./domain.js";
import { hashPaymentIntent } from "./intent-hash.js";
import type { ObservedFixedAllowance } from "./solana-allowance.js";

export interface ApprovedOnchainExecution {
  readonly authorization: "AGENTSAFE_ONCHAIN_EXECUTION_V1";
  readonly requestHash: string;
  readonly policyVersionId: string;
  readonly amountBaseUnits: bigint;
  readonly allowanceDelegationAddress: string;
  readonly allowanceRemainingBaseUnits: bigint;
  readonly expiresAt: string;
}

/**
 * Binds a deterministic ALLOW decision to a specific observed fixed allowance.
 * This is authorization data only: it does not sign, submit or settle a
 * transfer, and must be revalidated immediately before submission.
 */
export function authorizeOnchainExecution(input: {
  readonly intent: PaymentIntent;
  readonly decision: PolicyDecision;
  readonly allowance: ObservedFixedAllowance;
  readonly now: string;
}): ApprovedOnchainExecution {
  if (input.decision.decision !== "ALLOW") {
    throw new Error("only an ALLOW decision can authorize onchain execution");
  }
  if (input.allowance.expired || Date.parse(input.now) >= Date.parse(input.allowance.expiresAt)) {
    throw new Error("onchain allowance is expired");
  }
  if (input.intent.amountBaseUnits > input.allowance.remainingBaseUnits) {
    throw new Error("onchain allowance is insufficient");
  }
  return {
    authorization: "AGENTSAFE_ONCHAIN_EXECUTION_V1",
    requestHash: hashPaymentIntent(input.intent),
    policyVersionId: input.decision.policyVersionId,
    amountBaseUnits: input.intent.amountBaseUnits,
    allowanceDelegationAddress: input.allowance.delegationAddress,
    allowanceRemainingBaseUnits: input.allowance.remainingBaseUnits,
    expiresAt: input.allowance.expiresAt,
  };
}
