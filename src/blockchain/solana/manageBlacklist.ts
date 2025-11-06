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
 * Add an address to the group blacklist (admin only)
 */
export interface AddToBlacklistParams {
  telegramId: number;
  groupPDA: string;
  addressToBlacklist: string;
}

export async function addToBlacklist(params: AddToBlacklistParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);
    const addressToBlacklistPubkey = new PublicKey(params.addressToBlacklist);

    // Check if the address is already a member (to determine if we need to include member_profile)
    const [memberProfilePDA] = deriveMemberProfilePDA(groupPubkey, addressToBlacklistPubkey);
    const connection = getSolanaConnection();

    let memberAccountInfo;
    let isMember = false;
    try {
      memberAccountInfo = await connection.getAccountInfo(memberProfilePDA);
      isMember = memberAccountInfo !== null && memberAccountInfo.data.length > 0;
    } catch (error) {
      console.warn('Failed to check member profile, assuming not a member:', error);
      isMember = false;
    }

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

    console.log(`Adding address to blacklist: ${params.addressToBlacklist}`);
    console.log(`Group PDA: ${params.groupPDA}`);
    console.log(`Is member: ${isMember}`);
    if (isMember) {
      console.log(`Member Profile PDA: ${memberProfilePDA.toBase58()}`);
    }

    // Execute the transaction with timeout
    // Include member_profile account only if the address is already a member
    const tx = await executeTransactionWithTimeout(async () => {
      const accounts: any = {
        signer: signer,
        group: groupPubkey,
        addressToBlacklist: addressToBlacklistPubkey,
        systemProgram: SystemProgram.programId,
      };

      // Add optional member_profile if the address is a member
      if (isMember) {
        accounts.memberProfile = memberProfilePDA;
      }

      return await program.methods
        .addToBlacklist()
        .accounts(accounts)
        .rpc();
    }, 120000);

    console.log(`Address blacklisted! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Add to blacklist transaction ${tx} failed verification`);
    }

    return {
      success: true,
      signature: tx,
      blacklistedAddress: params.addressToBlacklist,
      wasKicked: isMember
    };
  } catch (error) {
    console.error("Error adding address to blacklist:", error);
    throw error;
  }
}

/**
 * Remove an address from the group blacklist (admin only)
 */
export interface RemoveFromBlacklistParams {
  telegramId: number;
  groupPDA: string;
  addressToUnblacklist: string;
}

export async function removeFromBlacklist(params: RemoveFromBlacklistParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);
    const addressToUnblacklistPubkey = new PublicKey(params.addressToUnblacklist);

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

    console.log(`Removing address from blacklist: ${params.addressToUnblacklist}`);
    console.log(`Group PDA: ${params.groupPDA}`);

    // Execute the transaction with timeout
    // Fixed: Use correct account name as per IDL (address_to_unblacklist)
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .removeFromBlacklist()
        .accounts({
          signer: signer,
          group: groupPubkey,
          addressToUnblacklist: addressToUnblacklistPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, 120000);

    console.log(`Address removed from blacklist! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Remove from blacklist transaction ${tx} failed verification`);
    }

    return {
      success: true,
      signature: tx,
      unblacklistedAddress: params.addressToUnblacklist
    };
  } catch (error) {
    console.error("Error removing address from blacklist:", error);
    throw error;
  }
}
