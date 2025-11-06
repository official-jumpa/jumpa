import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getSolanaConnection } from "@shared/utils/rpcConfig";
import {
  getProviderForUser,
  getProgram,
  deriveMemberProfilePDA,
  checkWalletBalance,
  executeTransactionWithTimeout,
  verifyTransactionSuccess
} from "./utils";

/**
 * Join an existing group
 */
export interface JoinGroupParams {
  telegramId: number;
  groupPDA: string;
  ownerPubkey: string;
  memberName: string;
}

export async function joinGroup(params: JoinGroupParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);
    const ownerPubkey = new PublicKey(params.ownerPubkey);

    // Check if member profile already exists
    const [memberProfilePDA] = deriveMemberProfilePDA(groupPubkey, signer);
    const connection = getSolanaConnection();

    let memberAccountInfo;
    try {
      memberAccountInfo = await connection.getAccountInfo(memberProfilePDA);
    } catch (rpcError) {
      console.warn('Failed to check existing member profile, continuing anyway:', rpcError);
      memberAccountInfo = null;
    }

    if (memberAccountInfo && memberAccountInfo.data.length > 0) {
      throw new Error(`You are already a member of this group. Member profile exists at: ${memberProfilePDA.toBase58()}`);
    }

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

    console.log(`Joining group: ${params.groupPDA}`);
    console.log(`Member Profile PDA: ${memberProfilePDA.toBase58()}`);

    // Execute the transaction with timeout
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .joinGroup(params.memberName)
        .accounts({
          signer: signer,
          owner: ownerPubkey,
          group: groupPubkey,
          memberProfile: memberProfilePDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, 120000);

    console.log(`Joined group! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Join group transaction ${tx} failed verification`);
    }

    return {
      success: true,
      memberProfilePDA: memberProfilePDA.toBase58(),
      signature: tx,
    };
  } catch (error) {
    console.error("Error joining group:", error);
    throw error;
  }
}
