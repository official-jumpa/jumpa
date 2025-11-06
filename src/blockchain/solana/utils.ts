import { PublicKey, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, Idl } from "@coral-xyz/anchor";
import { getSolanaConnection } from "@shared/utils/rpcConfig";
import { decryptPrivateKey } from "@shared/utils/encryption";
import idlJson from "./idl.json";
import User from "@database/models/user";

// Program ID from IDL
export const PROGRAM_ID = new PublicKey(idlJson.address);

// Seed constants
export const GROUP_SEED = Buffer.from("GROUP_SEED");
export const MEMBER_SEED = Buffer.from("MEMBER_SEED");

/**
 * Create a wallet wrapper from keypair
 */
export function createWalletFromKeypair(keypair: Keypair): Wallet {
  return {
    publicKey: keypair.publicKey,
    payer: keypair,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if (tx instanceof Transaction) {
        tx.partialSign(keypair);
      }
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
      return txs.map(tx => {
        if (tx instanceof Transaction) {
          tx.partialSign(keypair);
        }
        return tx;
      });
    }
  };
}

/**
 * Get Anchor provider for a user
 */
export async function getProviderForUser(telegramId: number): Promise<AnchorProvider> {
  const connection = getSolanaConnection();
  const user = await User.findOne({ telegram_id: telegramId });

  if (!user) {
    throw new Error("User not found. Please register first.");
  }

  // Decrypt private key and create keypair
  const decryptedKey = decryptPrivateKey(user.solanaWallets[0].encryptedPrivateKey);
  const keypair = Keypair.fromSecretKey(
    Buffer.from(decryptedKey, 'hex')
  );

  // Create wallet wrapper
  const wallet = createWalletFromKeypair(keypair);

  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

/**
 * Get the Anchor program instance
 */
export function getProgram(provider: AnchorProvider): Program {
  return new Program(idlJson as any, provider);
}

/**
 * Derive Group PDA
 */
export function deriveGroupPDA(groupName: string, signer: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [GROUP_SEED, Buffer.from(groupName.toUpperCase(), 'utf8'), signer.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive MemberProfile PDA
 */
export function deriveMemberProfilePDA(group: PublicKey, member: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MEMBER_SEED, group.toBuffer(), member.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Check if a group already exists on-chain
 */
export async function checkGroupExists(groupName: string, signer: PublicKey): Promise<boolean> {
  try {
    const [groupPDA] = deriveGroupPDA(groupName, signer);

    const connection = getSolanaConnection();
    const accountInfo = await connection.getAccountInfo(groupPDA);

    return accountInfo !== null && accountInfo.data.length > 0;
  } catch (error) {
    console.error("Error checking group existence:", error);
    return false;
  }
}

/**
 * Check if wallet has sufficient balance for transaction
 */
export async function checkWalletBalance(
  walletAddress: PublicKey,
  minBalanceLamports: number = 5000000
): Promise<{ hasBalance: boolean; balance: number; minBalance: number }> {
  try {
    const connection = getSolanaConnection();
    const balance = await connection.getBalance(walletAddress);

    return {
      hasBalance: balance >= minBalanceLamports,
      balance: balance,
      minBalance: minBalanceLamports
    };
  } catch (error) {
    console.error("Error checking wallet balance:", error);
    return {
      hasBalance: false,
      balance: 0,
      minBalance: minBalanceLamports
    };
  }
}

/**
 * Execute a Solana transaction with timeout
 */
export async function executeTransactionWithTimeout<T>(
  transactionFn: () => Promise<T>,
  timeoutMs: number = 120000
): Promise<T> {
  console.log(`Executing transaction with ${timeoutMs}ms timeout...`);

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Transaction timed out after ${timeoutMs}ms. The transaction may still have succeeded on-chain. Please check the blockchain explorer.`));
    }, timeoutMs);
  });

  const result = await Promise.race([
    transactionFn(),
    timeoutPromise
  ]);

  console.log(`Transaction completed successfully`);
  return result;
}

/**
 * Verify transaction was successful
 */
export async function verifyTransactionSuccess(signature: string): Promise<boolean> {
  try {
    const connection = getSolanaConnection();

    await new Promise(resolve => setTimeout(resolve, 2000));

    const txDetails = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });

    if (!txDetails) {
      console.log('Transaction not found in blockchain');
      return false;
    }

    if (txDetails.meta?.err) {
      console.log('Transaction failed:', txDetails.meta.err);
      return false;
    }

    console.log('Transaction verified successfully');
    return true;
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return false;
  }
}
