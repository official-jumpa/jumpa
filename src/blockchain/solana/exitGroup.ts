import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  getProviderForUser,
  getProgram,
  deriveGroupPDA,
  deriveMemberProfilePDA,
  checkWalletBalance,
  executeTransactionWithTimeout,
  verifyTransactionSuccess
} from "./utils";

/**
 * Exit a group
 */
export interface ExitGroupParams {
  telegramId: number;
  groupName: string;
  ownerPubkey: string;
}

export async function exitGroup(params: ExitGroupParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const ownerPubkey = new PublicKey(params.ownerPubkey);
    const [groupPDA] = deriveGroupPDA(params.groupName, ownerPubkey);
    const [memberProfilePDA] = deriveMemberProfilePDA(groupPDA, signer);

    console.log(`Exiting group: ${params.groupName}`);
    console.log(`Group PDA: ${groupPDA.toBase58()}`);
    console.log(`Member Profile PDA: ${memberProfilePDA.toBase58()}`);

    // Check wallet balance
    let balanceCheck;
    try {
      balanceCheck = await checkWalletBalance(signer, 5000000);
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

    // Execute the transaction with timeout
    // Note: exitGroup accepts NO parameters according to the new IDL
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .exitGroup() // No parameters
        .accounts({
          signer: signer,
          group: groupPDA,
          memberProfile: memberProfilePDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, 120000);

    console.log(`Exited group! Transaction: ${tx}`);

    // Verify transaction
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Exit group transaction ${tx} failed verification`);
    }

    return {
      success: true,
      signature: tx,
    };
  } catch (error) {
    console.error("Error exiting group:", error);
    throw error;
  }
}
