import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  getProviderForUser,
  getProgram,
  checkWalletBalance,
  executeTransactionWithTimeout,
  verifyTransactionSuccess
} from "./utils";

/**
 * Add a trader to the group
 */
export interface AddTraderParams {
  telegramId: number;
  groupPDA: string;
  traderPubkey: string;
}

export async function addTrader(params: AddTraderParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);
    const traderPubkey = new PublicKey(params.traderPubkey);

    // Check wallet balance before attempting transaction
    let balanceCheck;
    try {
      balanceCheck = await checkWalletBalance(signer, 5000000); // 0.005 SOL minimum
      if (!balanceCheck.hasBalance) {
        const balanceInSol = (balanceCheck.balance / 1000000000).toFixed(4);
        const minBalanceInSol = (balanceCheck.minBalance / 1000000000).toFixed(4);
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

    console.log(`Adding trader: ${params.traderPubkey}`);

    // Execute the transaction with timeout
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .addTrader()
        .accounts({
          signer: signer,
          group: groupPubkey,
          trader: traderPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc({
          skipPreflight: false,
          commitment: 'confirmed',
        });
    }, 120000);

    console.log(`Trader added! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Add trader transaction ${tx} failed verification`);
    }

    return {
      success: true,
      signature: tx,
    };
  } catch (error) {
    console.error("Error adding trader:", error);
    throw error;
  }
}

/**
 * Remove a trader from the group
 */
export interface RemoveTraderParams {
  telegramId: number;
  groupPDA: string;
  traderPubkey: string;
}

export async function removeTrader(params: RemoveTraderParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);
    const traderPubkey = new PublicKey(params.traderPubkey);

    // Check wallet balance before attempting transaction
    let balanceCheck;
    try {
      balanceCheck = await checkWalletBalance(signer, 5000000); // 0.005 SOL minimum
      if (!balanceCheck.hasBalance) {
        const balanceInSol = (balanceCheck.balance / 1000000000).toFixed(4);
        const minBalanceInSol = (balanceCheck.minBalance / 1000000000).toFixed(4);
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

    console.log(`Removing trader: ${params.traderPubkey}`);

    // Execute the transaction with timeout
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .removeTrader()
        .accounts({
          signer: signer,
          group: groupPubkey,
          trader: traderPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, 120000);

    console.log(`Trader removed! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Remove trader transaction ${tx} failed verification`);
    }

    return {
      success: true,
      signature: tx,
    };
  } catch (error) {
    console.error("Error removing trader:", error);
    throw error;
  }
}
