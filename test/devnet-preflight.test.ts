import assert from "node:assert/strict";
import test from "node:test";
import { devnetPreflight } from "../src/demo/devnet-preflight.js";

test("preflight reports only missing public configuration", () => {
  const output = devnetPreflight({});
  assert.equal(output.environment, "DEVNET");
  assert.equal(output.ready, false);
  assert.equal(output.missing.length, 5);
  assert.match(output.safety, /No private key/);
});

test("preflight is ready with every public Devnet value", () => {
  const output = devnetPreflight({
    DEVNET_RPC_URL: "https://api.devnet.solana.com",
    DEVNET_OWNER_PUBLIC_KEY: "owner",
    DEVNET_USDC_TOKEN_ACCOUNT: "token-account",
    DEVNET_USDC_MINT: "mint",
    AGENTSAFE_DELEGATEE_PUBLIC_KEY: "delegatee",
  });
  assert.equal(output.ready, true);
  assert.deepEqual(output.missing, []);
});
