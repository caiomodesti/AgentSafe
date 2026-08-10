import { pathToFileURL } from "node:url";
import { assessDevnetReadiness, type DevnetReadinessInput } from "../solana-allowance.js";

export function devnetPreflight(environment: NodeJS.ProcessEnv = process.env) {
  const values = {
    rpcUrl: environment.DEVNET_RPC_URL,
    owner: environment.DEVNET_OWNER_PUBLIC_KEY,
    tokenAccount: environment.DEVNET_USDC_TOKEN_ACCOUNT,
    mint: environment.DEVNET_USDC_MINT,
    delegatee: environment.AGENTSAFE_DELEGATEE_PUBLIC_KEY,
  };
  const input = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as DevnetReadinessInput;
  const readiness = assessDevnetReadiness(input);
  return {
    environment: "DEVNET",
    ready: readiness.ready,
    missing: readiness.missing,
    nextAction: readiness.ready
      ? "Read Subscription Authority init_id, compile fixed allowance instructions, then request an external signer."
      : "Configure only the missing public Devnet values from .env.devnet.example.",
    safety: "No private key is read, printed, generated, signed, or submitted by this preflight.",
  } as const;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${JSON.stringify(devnetPreflight(), null, 2)}\n`);
}
