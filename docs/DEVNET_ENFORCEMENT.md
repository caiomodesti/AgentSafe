# Devnet enforcement plan

AgentSafe demonstrates a **finite delegated authority** on Solana Devnet. The policy engine decides whether a request can proceed; the chain independently enforces the maximum authority received by the AgentSafe wallet.

The interactive Lab currently uses Solana SPL Token's native `Approve` delegation because it is the smallest real primitive that can be signed with Phantom: the owner grants the AgentSafe delegatee exactly `20 test-USDC`. A transfer above its remaining delegated amount fails in the Token Program even if a client tries to submit it.

## Demo proof

1. Create a disposable Devnet owner, token account and 100 test-USDC balance.
2. Use the connected owner wallet to create an SPL Token delegation of `20 test-USDC` for the AgentSafe delegatee.
3. Show the on-chain delegated amount and feed its remaining authority into Financial Blast Radius.
4. Switch Phantom to the AgentSafe delegatee and submit a policy-allowed `0.55 test-USDC` transfer.
5. Reconcile the new delegated amount.
6. Submit a `21 test-USDC` boundary transfer; it must fail in the Token Program and no funds move.
7. Revoke the delegation after the demonstration if the test token is to be reused.

## Safety boundary

- A private key is never supplied to AgentSafe through the UI, database or logs.
- The Devnet owner signer is supplied only by a server-side signer integration or an interactive wallet.
- The first integration uses a disposable Devnet account and a test token; no mainnet authority is created.
- `REQUIRE_APPROVAL` is not spend authorization. An approval must be hash-bound and reevaluated before submission.
- The read-only reconciliation path accepts only an HTTPS RPC and needs no signer. It reports the on-chain amount at read time rather than inferring an original allowance from an off-chain counter.
- An on-chain execution authorization is derived only from an `ALLOW` decision and a non-expired reconciled allowance. It binds the canonical intent hash, policy version, amount and delegation address; submission must repeat this validation immediately before signing.

## Next enforcement adapter

For an expiry-aware production adapter, the core integration targets `@solana/subscriptions` and its fixed-delegation overlay instruction. The official SDK exposes Subscription Authority initialization, fixed delegation creation, transfer, and revocation; see the [Solana Subscriptions repository](https://github.com/solana-foundation/subscriptions) and [Solana fixed delegation documentation](https://solana.com/docs/payments/subscriptions/fixed-delegation). This is a planned stronger authority primitive, not a claim about the live SPL Token Lab proof.
