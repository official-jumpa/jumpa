// getJupiterSwapData.ts
import { PublicKey, AccountMeta } from "@solana/web3.js";

export interface JupiterSwapData {
  instructionData: Buffer;
  remainingAccounts: AccountMeta[];
  programId: PublicKey;
  // Optional returned pieces you might want to include
  setupInstructions?: Array<{ programId: string; data: string; accounts: any[] }>;
  otherInstructions?: Array<{ programId: string; data: string; accounts: any[] }>;
  cleanupInstruction?: { programId: string; data: string; accounts: any[] } | null;
  addressLookupTableAddresses?: string[] | null;
  quoteResponse: any;
}

/**
 * Build swap instruction data + remaining accounts using the Jupiter
 * swap-instructions endpoint (correct endpoint per docs).
 *
 * - quoteResponse: the object returned from /quote (you must fetch /quote first)
 * - userPublicKey: typically the signer pubkey that will sign (for group CPI, put your group PDA or signer depending on who signs)
 */
export async function getJupiterSwapData(
  quoteResponse: any,
  userPublicKey: string,
  opts?: {
    wrapAndUnwrapSol?: boolean;
    useSharedAccounts?: boolean;
    payer?: string | null;
    prioritizationFeeLamports?: any;
    asLegacyTransaction?: boolean;
  }
): Promise<JupiterSwapData> {
  const url = "https://lite-api.jup.ag/swap/v1/swap-instructions";

  const body: any = {
    userPublicKey,
    quoteResponse,
    wrapAndUnwrapSol: opts?.wrapAndUnwrapSol ?? true,
    useSharedAccounts: opts?.useSharedAccounts,
    payer: opts?.payer,
    asLegacyTransaction: opts?.asLegacyTransaction ?? false,
    prioritizationFeeLamports: opts?.prioritizationFeeLamports,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    console.log("text response from swap data", t)
    throw new Error(`Failed to build Jupiter swap instructions: ${res.status} ${res.statusText} - ${t}`);
  }

  const swapData = await res.json();
  console.log("swapData", swapData)

  if (!swapData.swapInstruction) {
    throw new Error("swap-instructions response missing swapInstruction");
  }

  // Convert base64 instruction data -> Buffer
  const swapIx = swapData.swapInstruction;
  const instructionData = Buffer.from(swapIx.data, "base64");

  // Map Jupiter keys to AccountMeta usable by anchor .remainingAccounts(...)
  const remainingAccounts: AccountMeta[] = (swapIx.accounts || []).map((k: any) => ({
    pubkey: new PublicKey(k.pubkey),
    isSigner: !!k.isSigner,
    isWritable: !!k.isWritable,
  }));

  return {
    instructionData,
    remainingAccounts,
    programId: new PublicKey(swapIx.programId),
    setupInstructions: swapData.setupInstructions ?? undefined,
    otherInstructions: swapData.otherInstructions ?? undefined,
    cleanupInstruction: swapData.cleanupInstruction ?? undefined,
    addressLookupTableAddresses: swapData.addressLookupTableAddresses ?? null,
    quoteResponse: swapData.quoteResponse ?? quoteResponse,
  };
}
