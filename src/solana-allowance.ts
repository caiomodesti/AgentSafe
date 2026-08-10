import type { Network } from "./domain.js";
import { address, createSolanaRpc, type Address, type Instruction, type TransactionSigner } from "@solana/kit";
import {
  fetchFixedDelegation,
  getCreateFixedDelegationOverlayInstructionAsync,
  getInitSubscriptionAuthorityOverlayInstructionAsync,
} from "@solana/subscriptions";

/** A provider boundary: policy decisions stay in the deterministic core. */
export interface CreateSolanaAllowance {
  readonly network: Extract<Network, "DEVNET">;
  readonly owner: string;
  readonly tokenAccount: string;
  readonly mint: string;
  readonly delegatee: string;
  readonly maximumBaseUnits: bigint;
  readonly expiresAt: string;
}

export interface SolanaAllowanceState {
  readonly network: Extract<Network, "DEVNET">;
  readonly delegationAddress: string;
  readonly owner: string;
  readonly delegatee: string;
  readonly mint: string;
  readonly maximumBaseUnits: bigint;
  readonly spentBaseUnits: bigint;
  readonly remainingBaseUnits: bigint;
  readonly expiresAt: string;
  readonly source: "ONCHAIN";
}

export interface SolanaAllowanceReceipt {
  readonly transactionSignature: string;
  readonly delegationAddress: string;
  readonly network: Extract<Network, "DEVNET">;
}

export interface SolanaAllowanceAdapter {
  createFixedAllowance(input: CreateSolanaAllowance): Promise<SolanaAllowanceReceipt>;
  getAllowance(delegationAddress: string): Promise<SolanaAllowanceState>;
  revokeAllowance(delegationAddress: string): Promise<{ readonly transactionSignature: string }>;
}

/**
 * Server-side input for compiling official Solana Subscriptions instructions.
 * `owner` is a signer capability injected by a wallet/server integration; this
 * module neither constructs private keys nor submits the resulting plan.
 */
export interface FixedAllowanceInstructionPlanInput {
  readonly owner: TransactionSigner;
  readonly payer?: TransactionSigner;
  readonly tokenMint: Address;
  readonly tokenProgram: Address;
  readonly userAta: Address;
  readonly delegatee: Address;
  readonly maximumBaseUnits: bigint;
  readonly expiresAt: string;
  readonly nonce: bigint;
  /** Read from the live Subscription Authority immediately before planning. */
  readonly expectedSubscriptionAuthorityInitId: bigint;
}

export interface FixedAllowanceInstructionPlan {
  readonly kind: "SOLANA_FIXED_ALLOWANCE";
  readonly instructions: readonly Instruction[];
  readonly maximumBaseUnits: bigint;
  readonly expiryTs: bigint;
  readonly submission: "CALLER_MUST_SIGN_AND_SEND";
}

export interface ObservedFixedAllowance {
  readonly network: Extract<Network, "DEVNET">;
  readonly delegationAddress: string;
  readonly owner: string;
  readonly delegatee: string;
  readonly mint: string;
  /** The amount stored by the on-chain fixed-delegation account at read time. */
  readonly remainingBaseUnits: bigint;
  readonly expiresAt: string;
  readonly expired: boolean;
  readonly source: "ONCHAIN";
}

/**
 * Builds, but deliberately never signs or sends, the two official program
 * instructions required for a fresh fixed allowance.
 */
export async function compileFixedAllowanceInstructionPlan(
  input: FixedAllowanceInstructionPlanInput,
): Promise<FixedAllowanceInstructionPlan> {
  if (input.maximumBaseUnits <= 0n) throw new RangeError("maximumBaseUnits must be positive");
  if (input.nonce < 0n) throw new RangeError("nonce must be non-negative");
  const expiryMs = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) {
    throw new RangeError("expiresAt must be a valid future timestamp");
  }
  const expiryTs = BigInt(Math.floor(expiryMs / 1_000));
  const initAuthority = await getInitSubscriptionAuthorityOverlayInstructionAsync({
    owner: input.owner,
    ...(input.payer ? { payer: input.payer } : {}),
    tokenMint: input.tokenMint,
    tokenProgram: input.tokenProgram,
    userAta: input.userAta,
  });
  const createDelegation = await getCreateFixedDelegationOverlayInstructionAsync({
    delegator: input.owner,
    ...(input.payer ? { payer: input.payer } : {}),
    tokenMint: input.tokenMint,
    delegatee: input.delegatee,
    amount: input.maximumBaseUnits,
    expiryTs,
    nonce: input.nonce,
    expectedSubscriptionAuthorityInitId: input.expectedSubscriptionAuthorityInitId,
  });
  return {
    kind: "SOLANA_FIXED_ALLOWANCE",
    instructions: [initAuthority, createDelegation],
    maximumBaseUnits: input.maximumBaseUnits,
    expiryTs,
    submission: "CALLER_MUST_SIGN_AND_SEND",
  };
}

/** Read-only reconciliation against a Devnet RPC. It never requests a signer. */
export async function readFixedAllowanceFromDevnet(input: {
  readonly rpcUrl: string;
  readonly delegationAddress: string;
  readonly now?: string;
}): Promise<ObservedFixedAllowance> {
  const url = new URL(input.rpcUrl);
  if (url.protocol !== "https:") throw new RangeError("Devnet RPC URL must use https");
  const rpc = createSolanaRpc(url.toString());
  const delegationAddress = address(input.delegationAddress);
  const account = await fetchFixedDelegation(rpc, delegationAddress);
  const expiresAt = new Date(Number(account.data.expiryTs) * 1_000).toISOString();
  const now = input.now === undefined ? Date.now() : Date.parse(input.now);
  if (!Number.isFinite(now)) throw new RangeError("now must be a valid timestamp");
  return {
    network: "DEVNET",
    delegationAddress,
    owner: account.data.header.delegator,
    delegatee: account.data.header.delegatee,
    mint: account.data.mint,
    remainingBaseUnits: account.data.amount,
    expiresAt,
    expired: now >= Date.parse(expiresAt),
    source: "ONCHAIN",
  };
}

export interface DevnetReadinessInput {
  readonly rpcUrl?: string;
  readonly owner?: string;
  readonly tokenAccount?: string;
  readonly mint?: string;
  readonly delegatee?: string;
}

export interface DevnetReadiness {
  readonly ready: boolean;
  readonly missing: readonly string[];
  readonly notices: readonly string[];
}

/**
 * Validates configuration only. It never reads a seed phrase or signs a
 * transaction. The concrete adapter belongs in the server-side Devnet app.
 */
export function assessDevnetReadiness(input: DevnetReadinessInput): DevnetReadiness {
  const required: ReadonlyArray<[keyof DevnetReadinessInput, string]> = [
    ["rpcUrl", "DEVNET_RPC_URL"],
    ["owner", "DEVNET_OWNER_PUBLIC_KEY"],
    ["tokenAccount", "DEVNET_USDC_TOKEN_ACCOUNT"],
    ["mint", "DEVNET_USDC_MINT"],
    ["delegatee", "AGENTSAFE_DELEGATEE_PUBLIC_KEY"],
  ];
  const missing = required.filter(([key]) => !input[key]?.trim()).map(([, label]) => label);
  return {
    ready: missing.length === 0,
    missing,
    notices: [
      "Use a disposable Devnet owner and test token account.",
      "Keep the owner signer outside the AgentSafe database and browser bundle.",
      "Create a fixed delegation with a finite expiry, then reconcile the onchain remaining amount.",
    ],
  };
}
