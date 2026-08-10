"use client";

import { useState } from "react";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, clusterApiUrl } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, MINT_SIZE, TOKEN_PROGRAM_ID, createApproveInstruction, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createMintToInstruction, createTransferInstruction, getAssociatedTokenAddress } from "@solana/spl-token";

const DEVNET = new Connection(clusterApiUrl("devnet"), "confirmed");
const ALLOWANCE_BASE_UNITS = 20_000_000n;
const AGENT_FEE_LAMPORTS = 5_000_000;
type PhantomProvider = { isPhantom?: boolean; publicKey?: PublicKey; connect: () => Promise<{ publicKey: PublicKey }>; signTransaction: (transaction: Transaction) => Promise<Transaction>; };
declare global { interface Window { phantom?: { solana?: PhantomProvider }; } }

type DemoAuthority = { agent: Keypair; mint: PublicKey; treasuryTokenAccount: PublicKey; agentTokenAccount: PublicKey };

export function WalletPanel() {
  const [owner, setOwner] = useState<PublicKey>();
  const [balance, setBalance] = useState<number>();
  const [demo, setDemo] = useState<DemoAuthority>();
  const [status, setStatus] = useState("Connect one Phantom Devnet wallet, then create the guided demo.");
  const [busy, setBusy] = useState(false);
  const provider = () => window.phantom?.solana;

  async function connect() {
    const wallet = provider();
    if (!wallet?.isPhantom) { setStatus("Phantom was not found. Open this page in a browser with the Phantom extension enabled."); return; }
    try {
      const connected = await wallet.connect();
      const lamports = await DEVNET.getBalance(connected.publicKey, "confirmed");
      setOwner(connected.publicKey); setBalance(lamports / 1_000_000_000);
      setStatus("Treasury wallet connected. No transaction has been requested.");
    } catch { setStatus("Wallet connection was cancelled or failed."); }
  }

  async function createGuidedDemo() {
    const wallet = provider(); if (!wallet || !owner) return;
    setBusy(true); setStatus("Preparing one Devnet setup transaction: test token, temporary AgentSafe identity, 20-token authority, and a small fee balance. Review it in Phantom.");
    try {
      const mint = Keypair.generate();
      const agent = Keypair.generate();
      const treasuryTokenAccount = await getAssociatedTokenAddress(mint.publicKey, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      const agentTokenAccount = await getAssociatedTokenAddress(mint.publicKey, agent.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      const rent = await DEVNET.getMinimumBalanceForRentExemption(MINT_SIZE, "confirmed");
      const transaction = new Transaction().add(
        SystemProgram.createAccount({ fromPubkey: owner, newAccountPubkey: mint.publicKey, space: MINT_SIZE, lamports: rent, programId: TOKEN_PROGRAM_ID }),
        createInitializeMintInstruction(mint.publicKey, 6, owner, null, TOKEN_PROGRAM_ID),
        createAssociatedTokenAccountInstruction(owner, treasuryTokenAccount, owner, mint.publicKey, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
        createAssociatedTokenAccountInstruction(owner, agentTokenAccount, agent.publicKey, mint.publicKey, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
        createMintToInstruction(mint.publicKey, treasuryTokenAccount, owner, 100_000_000n, [], TOKEN_PROGRAM_ID),
        SystemProgram.transfer({ fromPubkey: owner, toPubkey: agent.publicKey, lamports: AGENT_FEE_LAMPORTS }),
        createApproveInstruction(treasuryTokenAccount, agent.publicKey, owner, ALLOWANCE_BASE_UNITS, [], TOKEN_PROGRAM_ID),
      );
      const latest = await DEVNET.getLatestBlockhash("confirmed");
      transaction.feePayer = owner; transaction.recentBlockhash = latest.blockhash; transaction.partialSign(mint);
      const signed = await wallet.signTransaction(transaction);
      const signature = await DEVNET.sendRawTransaction(signed.serialize());
      await DEVNET.confirmTransaction({ signature, ...latest }, "confirmed");
      setDemo({ agent, mint: mint.publicKey, treasuryTokenAccount, agentTokenAccount });
      setStatus(`Guided demo ready. Treasury minted 100 test-USDC and granted the temporary AgentSafe identity exactly 20.00. Setup tx: ${signature}`);
    } catch (error) { setStatus(`The guided setup was not created: ${error instanceof Error ? error.message : "Unknown wallet error"}`); } finally { setBusy(false); }
  }

  async function executeDelegatedPayment(amount: bigint, label: string) {
    if (!demo) { setStatus("Create the guided demo first."); return; }
    setBusy(true); setStatus(`${label} is being submitted by the temporary AgentSafe identity. No Phantom signature is needed for this step.`);
    try {
      const transaction = new Transaction().add(createTransferInstruction(demo.treasuryTokenAccount, demo.agentTokenAccount, demo.agent.publicKey, amount, [], TOKEN_PROGRAM_ID));
      const latest = await DEVNET.getLatestBlockhash("confirmed");
      transaction.feePayer = demo.agent.publicKey; transaction.recentBlockhash = latest.blockhash; transaction.sign(demo.agent);
      const signature = await DEVNET.sendRawTransaction(transaction.serialize());
      await DEVNET.confirmTransaction({ signature, ...latest }, "confirmed");
      setStatus(`${label} confirmed on Devnet. Tx: ${signature}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown Solana error";
      const reason = detail.includes("insufficient funds")
        ? "The SPL Token Program rejected this transfer: the temporary agent has only the delegated authority remaining, not 21 test-USDC. No tokens moved."
        : detail;
      setStatus(`${label} was blocked on-chain before settlement. ${reason}`);
    } finally { setBusy(false); }
  }

  return <section className="card wallet"><h2>One-wallet Devnet proof</h2><p className="muted">Use only one Phantom wallet. AgentSafe creates a temporary browser-only agent identity; your seed phrase and private key are never requested or exposed.</p><div className="wallet-actions"><button onClick={connect} disabled={busy}>{owner ? "Refresh treasury wallet" : "Connect Phantom"}</button><button className="secondary" onClick={createGuidedDemo} disabled={!owner || busy}>{busy ? "Waiting for Phantom…" : "1. Create guided 20-USDC demo"}</button><button className="secondary" onClick={() => executeDelegatedPayment(550_000n, "2. Allowed US$0.55 payment")} disabled={!demo || busy}>2. Run allowed US$0.55</button><button className="secondary" onClick={() => executeDelegatedPayment(21_000_000n, "3. Blocked US$21 boundary test")} disabled={!demo || busy}>3. Test blocked US$21</button></div>{owner && <p className="wallet-address"><code>{owner.toBase58()}</code>{balance !== undefined && <> · {balance.toFixed(3)} Devnet SOL</>}</p>}{demo && <p className="wallet-address">Temporary AgentSafe identity: <code>{demo.agent.publicKey.toBase58()}</code><br />Test mint: <code>{demo.mint.toBase58()}</code></p>}<p className="wallet-status">{status}</p></section>;
}
