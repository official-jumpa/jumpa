import { SystemProgram } from "@solana/web3.js";
import {
  getProviderForUser,
  getProgram,
  deriveGroupPDA,
  deriveMemberProfilePDA,
  checkGroupExists,
  checkWalletBalance,
  executeTransactionWithTimeout,
  verifyTransactionSuccess
} from "./utils";

/**
 * Initialize a new group on-chain
 *
 * Groups can be either:
 * - Public (isPrivate: false): Members are auto-approved when they join
 * - Private (isPrivate: true): Members must be approved by owner/trader after joining
 */
export interface CreateGroupParams {
  telegramId: number;
  groupName: string;
  adminName: string;
  isPrivate: boolean; // true for private groups (require approval), false for public groups
}

export async function createGroup(params: CreateGroupParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    // Check if group already exists on-chain
    const groupExists = await checkGroupExists(params.groupName, signer);
    if (groupExists) {
      const [groupPDA] = deriveGroupPDA(params.groupName, signer);
      throw new Error(`Group "${params.groupName}" already exists on-chain at address: ${groupPDA.toBase58()}`);
    }

    // Check wallet balance before attempting transaction
    const balanceCheck = await checkWalletBalance(signer, 50000000); // 0.05 SOL minimum
    console.log(`Wallet balance: ${balanceCheck.balance} lamports. Minimum required: ${balanceCheck.minBalance} lamports.`);
    if (!balanceCheck.hasBalance) {
      const balanceInSol = (balanceCheck.balance / 1000000000).toFixed(4);
      const minBalanceInSol = (balanceCheck.minBalance / 1000000000).toFixed(4);
      throw new Error(
        `Insufficient SOL balance. Your balance: ${balanceInSol} SOL. Minimum required: ${minBalanceInSol} SOL. ` +
        `Please fund your wallet at: ${signer.toBase58()}`
      );
    }

    // Derive PDAs
    const [groupPDA, groupBump] = deriveGroupPDA(params.groupName, signer);
    const [memberProfilePDA, memberBump] = deriveMemberProfilePDA(groupPDA, signer);

    console.log(`Initializing group: ${params.groupName}`);
    console.log(`Group type: ${params.isPrivate ? 'Private (requires approval)' : 'Public (auto-approved)'}`);
    console.log(`Derived Group PDA: ${groupPDA.toBase58()}`);
    console.log(`Derived Member Profile PDA: ${memberProfilePDA.toBase58()}`);

    // Execute the transaction with timeout
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .initializeGroup(
          params.groupName,
          params.adminName,
          params.isPrivate
        )
        .accounts({
          signer: signer,
          group: groupPDA,
          memberProfile: memberProfilePDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, 120000);

    console.log(`Group initialized! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Transaction ${tx} failed verification`);
    }

    return {
      success: true,
      groupPDA: groupPDA.toBase58(),
      memberProfilePDA: memberProfilePDA.toBase58(),
      signature: tx,
    };
  } catch (error) {
    console.error("Error initializing group:", error);
    throw error;
  }
}
