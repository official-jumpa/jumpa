import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  getProviderForUser,
  getProgram,
  deriveMemberProfilePDA,
  checkWalletBalance,
  executeTransactionWithTimeout,
  verifyTransactionSuccess
} from "./utils";

/**
 * Kick a member from the group (admin/trader only)
 * According to the IDL, this instruction:
 * - Requires signer to be admin or authorized trader
 * - Closes the member's profile account
 * - Returns the member's contribution with penalty applied
 * - Rent from closed account is returned to the kicked member
 */
export interface KickMemberParams {
  telegramId: number;
  groupPDA: string;
  memberToKickPubkey: string;
}

export async function kickMember(params: KickMemberParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);
    const memberToKickPubkey = new PublicKey(params.memberToKickPubkey);

    // Derive the member profile PDA for the member to be kicked
    const [memberProfilePDA] = deriveMemberProfilePDA(groupPubkey, memberToKickPubkey);

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

    console.log(`Kicking member: ${params.memberToKickPubkey}`);
    console.log(`Group PDA: ${params.groupPDA}`);
    console.log(`Member Profile PDA: ${memberProfilePDA.toBase58()}`);

    // Execute the transaction with timeout
    // According to IDL lines 603-665, kick_member instruction takes no arguments
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .kickMember()
        .accounts({
          signer: signer,
          group: groupPubkey,
          memberProfile: memberProfilePDA,
          memberToKick: memberToKickPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, 120000);

    console.log(`Member kicked! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Kick member transaction ${tx} failed verification`);
    }

    return {
      success: true,
      signature: tx,
      kickedMember: params.memberToKickPubkey,
      memberProfileClosed: memberProfilePDA.toBase58()
    };
  } catch (error) {
    console.error("Error kicking member:", error);
    throw error;
  }
}
