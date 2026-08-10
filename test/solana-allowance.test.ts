import assert from "node:assert/strict";
import test from "node:test";
import { address, type TransactionSigner } from "@solana/kit";
import {
  assessDevnetReadiness,
  compileFixedAllowanceInstructionPlan,
  readFixedAllowanceFromDevnet,
} from "../src/solana-allowance.js";

test("Devnet readiness is explicit and never asks for key material", () => {
  const missing = assessDevnetReadiness({});
  assert.equal(missing.ready, false);
  assert.deepEqual(missing.missing, [
    "DEVNET_RPC_URL",
    "DEVNET_OWNER_PUBLIC_KEY",
    "DEVNET_USDC_TOKEN_ACCOUNT",
    "DEVNET_USDC_MINT",
    "AGENTSAFE_DELEGATEE_PUBLIC_KEY",
  ]);
  assert.ok(missing.notices.every((notice) => notice.length > 0));

  const ready = assessDevnetReadiness({
    rpcUrl: "https://api.devnet.solana.com",
    owner: "owner",
    tokenAccount: "token-account",
    mint: "mint",
    delegatee: "delegatee",
  });
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.missing, []);
});

test("read-only reconciliation rejects a non-HTTPS RPC before any network call", async () => {
  await assert.rejects(
    readFixedAllowanceFromDevnet({
      rpcUrl: "http://api.devnet.solana.com",
      delegationAddress: "11111111111111111111111111111111",
    }),
    /https/,
  );
});

test("compiles official fixed-delegation instructions without signing or sending", async () => {
  const owner = {
    address: address("11111111111111111111111111111111"),
    signTransactions: async <T>(transactions: readonly T[]) => transactions,
  } as unknown as TransactionSigner;
  const plan = await compileFixedAllowanceInstructionPlan({
    owner,
    tokenMint: address("11111111111111111111111111111111"),
    tokenProgram: address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    userAta: address("11111111111111111111111111111111"),
    delegatee: address("11111111111111111111111111111111"),
    maximumBaseUnits: 20_000_000n,
    expiresAt: "2030-01-01T00:00:00.000Z",
    nonce: 0n,
    expectedSubscriptionAuthorityInitId: 0n,
  });
  assert.equal(plan.kind, "SOLANA_FIXED_ALLOWANCE");
  assert.equal(plan.instructions.length, 2);
  assert.equal(plan.maximumBaseUnits, 20_000_000n);
  assert.equal(plan.submission, "CALLER_MUST_SIGN_AND_SEND");
});

test("refuses expired or zero-value allowances before building instructions", async () => {
  const owner = {} as TransactionSigner;
  await assert.rejects(
    compileFixedAllowanceInstructionPlan({
      owner,
      tokenMint: address("11111111111111111111111111111111"),
      tokenProgram: address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      userAta: address("11111111111111111111111111111111"),
      delegatee: address("11111111111111111111111111111111"),
      maximumBaseUnits: 0n,
      expiresAt: "2030-01-01T00:00:00.000Z",
      nonce: 0n,
      expectedSubscriptionAuthorityInitId: 0n,
    }),
    /positive/,
  );
});
