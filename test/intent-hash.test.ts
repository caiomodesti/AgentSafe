import assert from "node:assert/strict";
import test from "node:test";
import type { PaymentIntent } from "../src/domain.js";
import { hashPaymentIntent } from "../src/intent-hash.js";

function intent(metadata: Readonly<Record<string, unknown>>): PaymentIntent {
  return {
    id: "intent-1",
    workspaceId: "workspace-1",
    agentId: "agent-1",
    taskId: "task-1",
    amountBaseUnits: 100_000n,
    token: "USDC",
    chain: "SOLANA",
    network: "DEVNET",
    merchant: "Tavily",
    recipient: "SafeRecipient",
    serviceCategory: "search",
    retryAttempt: 0,
    requestedAt: "2026-08-06T12:00:00.000Z",
    metadata,
  };
}

test("canonical hash is stable across nested object key order", () => {
  const left = hashPaymentIntent(intent({ z: 1, nested: { b: 2, a: 1 } }));
  const right = hashPaymentIntent(intent({ nested: { a: 1, b: 2 }, z: 1 }));
  assert.equal(left, right);
  assert.match(left, /^[a-f0-9]{64}$/);
});

test("hash changes for every approval-bound financial field", () => {
  const base = intent({ purpose: "research" });
  const baseHash = hashPaymentIntent(base);

  assert.notEqual(hashPaymentIntent({ ...base, amountBaseUnits: 100_001n }), baseHash);
  assert.notEqual(hashPaymentIntent({ ...base, recipient: "DifferentRecipient" }), baseHash);
  assert.notEqual(hashPaymentIntent({ ...base, merchant: "DifferentMerchant" }), baseHash);
  assert.notEqual(hashPaymentIntent({ ...base, taskId: "task-2" }), baseHash);
  assert.notEqual(hashPaymentIntent({ ...base, network: "MAINNET" }), baseHash);
});

