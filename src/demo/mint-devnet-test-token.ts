import { pathToFileURL } from "node:url";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const DECIMALS = 6;
const TOKEN_AMOUNT_BASE_UNITS = 100_000_000n; // 100 test units.

export interface DevnetTestTokenResult {
  readonly network: "DEVNET";
  readonly mint: string;
  readonly ownerTokenAccount: string;
  readonly owner: string;
  readonly amountBaseUnits: bigint;
  readonly decimals: number;
  readonly note: string;
}

/**
 * Creates an ephemeral-payer-funded test mint and mints it to a public Devnet
 * owner. The payer keypair exists only in memory and is never written to disk.
 */
export async function mintDevnetTestToken(ownerAddress: string): Promise<DevnetTestTokenResult> {
  const owner = new PublicKey(ownerAddress);
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const payer = Keypair.generate();
  const signature = await connection.requestAirdrop(payer.publicKey, 2_000_000_000);
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction({ signature, ...latestBlockhash }, "confirmed");

  const mint = await createMint(connection, payer, payer.publicKey, null, DECIMALS, undefined, undefined, TOKEN_PROGRAM_ID);
  const ownerTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    owner,
    false,
    "confirmed",
    undefined,
    TOKEN_PROGRAM_ID,
  );
  await mintTo(
    connection,
    payer,
    mint,
    ownerTokenAccount.address,
    payer,
    TOKEN_AMOUNT_BASE_UNITS,
    [],
    undefined,
    TOKEN_PROGRAM_ID,
  );
  return {
    network: "DEVNET",
    mint: mint.toBase58(),
    ownerTokenAccount: ownerTokenAccount.address.toBase58(),
    owner: owner.toBase58(),
    amountBaseUnits: TOKEN_AMOUNT_BASE_UNITS,
    decimals: DECIMALS,
    note: "Test token only. The ephemeral mint authority was not persisted and cannot mint again.",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const owner = process.env.DEVNET_OWNER_PUBLIC_KEY;
  if (!owner) throw new Error("DEVNET_OWNER_PUBLIC_KEY is required");
  if (!process.argv.includes("--execute")) {
    throw new Error("Pass --execute to create a Devnet test token");
  }
  mintDevnetTestToken(owner).then((result) => {
    process.stdout.write(`${JSON.stringify(result, (_key, value) => typeof value === "bigint" ? value.toString(10) : value, 2)}\n`);
  });
}
