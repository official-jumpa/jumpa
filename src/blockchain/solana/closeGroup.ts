import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  getProviderForUser,
  getProgram,
  checkWalletBalance,
  executeTransactionWithTimeout,
  verifyTransactionSuccess
} from "./utils";

/**
 * Close a group (admin only)
 */
export interface CloseGroupParams {
  telegramId: number;
  groupPDA: string;
}

export async function closeGroup(params: CloseGroupParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);

    // Check wallet balance for transaction fees
    let balanceCheck;
    try {
      balanceCheck = await checkWalletBalance(signer, 5_000_000); // 0.005 SOL for fees
      if (!balanceCheck.hasBalance) {
        const balanceInSol = (balanceCheck.balance / 1_000_000_000).toFixed(4);
        const minBalanceInSol = (balanceCheck.minBalance / 1_000_000_000).toFixed(4);
        throw new Error(
          `Insufficient SOL balance. Your balance: ${balanceInSol} SOL. Minimum required: ${minBalanceInSol} SOL. ` +
          `Please fund your wallet at: ${signer.toBase58()}`
        );
      }
    } catch (balanceError) {
      if (balanceError instanceof Error && balanceError.message.includes('Insufficient SOL')) {
        throw balanceError;
      }
      console.warn('Failed to check wallet balance, continuing anyway:', balanceError);
    }

    console.log(`Closing group: ${params.groupPDA}`);

    // Execute the transaction with timeout
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .closeGroup()
        .accounts({
          signer: signer,
          group: groupPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, 120000);

    console.log(`Group closed! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Close group transaction ${tx} failed verification`);
    }

    return {
      success: true,
      signature: tx,
    };
  } catch (error) {
    console.error("Error closing group:", error);
    throw error;
  }
}
