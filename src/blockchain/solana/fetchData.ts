import { PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { getSolanaConnection } from "@shared/utils/rpcConfig";
import {
  getProviderForUser,
  getProgram,
  createWalletFromKeypair
} from "./utils";

/**
 * Fetch on-chain Group account data
 */
export async function fetchGroupAccount(groupPDA: string, telegramId?: number) {
  try {
    let provider: AnchorProvider;

    if (telegramId) {
      provider = await getProviderForUser(telegramId);
    } else {
      // Use a read-only provider
      const connection = getSolanaConnection();
      const dummyKeypair = Keypair.generate();
      const wallet = createWalletFromKeypair(dummyKeypair);
      provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    }

    const program = getProgram(provider);
    const groupPubkey = new PublicKey(groupPDA);

    const groupAccount: any = await program.account['group'].fetch(groupPubkey);

    return {
      owner: groupAccount.owner.toBase58(),
      name: groupAccount.name,
      traders: groupAccount.traders.map((t: any) => t.toBase58()),
      members: groupAccount.members.map((m: any) => m.toBase58()),
      blacklist: groupAccount.blacklist.map((b: any) => b.toBase58()),
      minimumDeposit: groupAccount.minimumDeposit?.toString() || groupAccount.minimum_deposit?.toString() || "0",
      totalContributions: groupAccount.totalContributions?.toString() || groupAccount.total_contributions?.toString() || "0",
      exitPenaltyPercentage: groupAccount.exitPenaltyPercentage || groupAccount.exit_penalty_percentage || 0,
      lockPeriodDays: groupAccount.lockPeriodDays || groupAccount.lock_period_days || 0,
      locked: groupAccount.locked,
      isPrivate: groupAccount.isPrivate || groupAccount.is_private || false,
      state: groupAccount.state,
      createdAt: new Date((groupAccount.createdAt || groupAccount.created_at).toNumber() * 1000),
    };
  } catch (error) {
    console.error("Error fetching group account:", error);
    throw error;
  }
}

/**
 * Fetch on-chain MemberProfile account data
 */
export async function fetchMemberProfile(memberProfilePDA: string, telegramId?: number) {
  try {
    let provider: AnchorProvider;

    if (telegramId) {
      provider = await getProviderForUser(telegramId);
    } else {
      const connection = getSolanaConnection();
      const dummyKeypair = Keypair.generate();
      const wallet = createWalletFromKeypair(dummyKeypair);
      provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    }

    const program = getProgram(provider);
    const memberProfilePubkey = new PublicKey(memberProfilePDA);

    const memberProfile: any = await program.account['memberProfile'].fetch(memberProfilePubkey);

    return {
      group: memberProfile.group.toBase58(),
      pubkey: memberProfile.pubkey.toBase58(),
      name: memberProfile.name,
      contributionAmount: memberProfile.contributionAmount.toString(),
      joinedAt: new Date(memberProfile.joinedAt.toNumber() * 1000),
    };
  } catch (error) {
    console.error("Error fetching member profile:", error);
    throw error;
  }
}
