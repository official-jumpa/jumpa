/**
 * Blockchain Detector, Explorer, Response Mapper & Error Handler Utilities
 */

import { PublicKey } from "@solana/web3.js";
import { BlockchainType, BLOCKCHAIN_CONFIGS, TransactionResult } from "./types";

/**
 * Detect blockchain type from address format
 */
export function detectBlockchainType(address: string): BlockchainType {
  if (!address) {
    throw new Error("Address is required for blockchain detection");
  }

  if (address.startsWith("0x") && address.length === 42) {
    return BlockchainType.BASE;
  }

  try {
    new PublicKey(address);
    return BlockchainType.SOLANA;
  } catch {
    throw new Error(`Invalid blockchain address format: ${address}`);
  }
}

/**
 * Validate address for specific blockchain type
 */
export function validateAddress(address: string, type: BlockchainType): boolean {
  try {
    if (type === BlockchainType.BASE) {
      return address.startsWith("0x") && address.length === 42;
    } else if (type === BlockchainType.SOLANA) {
      new PublicKey(address);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get native currency for blockchain type
 */
export function getNativeCurrency(type: BlockchainType): string {
  return BLOCKCHAIN_CONFIGS[type].nativeCurrency;
}

/**
 * Get display name for blockchain type
 */
export function getDisplayName(type: BlockchainType): string {
  return BLOCKCHAIN_CONFIGS[type].displayName;
}

/**
 * Get blockchain explorer URL for transaction
 */
export function getExplorerUrl(
  type: BlockchainType,
  txHash: string,
  isTestnet = false
): string {
  const config = BLOCKCHAIN_CONFIGS[type];
  const baseUrl =
    isTestnet && config.testnetExplorerUrl
      ? config.testnetExplorerUrl
      : config.explorerUrl;

  return `${baseUrl}/tx/${txHash}`;
}

/**
 * Check if blockchain type is supported
 */
export function isSupported(type: string): boolean {
  return Object.values(BlockchainType).includes(type as BlockchainType);
}

/**
 * Get blockchain configuration
 */
export function getBlockchainConfig(type: BlockchainType) {
  return BLOCKCHAIN_CONFIGS[type];
}

// ===== RESPONSE MAPPER UTILITIES =====

export function normalizeTransactionResult(
  txHash: string,
  blockchain: BlockchainType,
  blockNumber?: number,
  slot?: number,
  isTestnet = false
): TransactionResult {
  return {
    success: true,
    transactionHash: txHash,
    blockNumber,
    slot,
    explorerUrl: getExplorerUrl(blockchain, txHash, isTestnet),
  };
}

export function weiToEth(wei: string | number): number {
  return Number(wei) / 1e18;
}

export function lamportsToSol(lamports: string | number): number {
  return Number(lamports) / 1e9;
}

export function ethToWei(eth: number): string {
  return (eth * 1e18).toString();
}

export function solToLamports(sol: number): string {
  return (sol * 1e9).toString();
}

// ===== ERROR HANDLER UTILITIES =====

export function handleBlockchainError(error: any, blockchain: BlockchainType): string {
  if (blockchain === BlockchainType.BASE) {
    return handleBaseError(error);
  } else if (blockchain === BlockchainType.SOLANA) {
    return handleSolanaError(error);
  }
  return getGenericErrorMessage(error);
}

function handleBaseError(error: any): string {
  const errorCode = error?.code;
  const errorMessage = error?.message || error?.info?.error?.message || "";

  if (errorCode === "INSUFFICIENT_FUNDS") return "Insufficient ETH balance for gas fees";
  if (errorCode === "CALL_EXCEPTION") return "Smart contract call failed. Please check state and try again.";
  if (errorCode === "UNPREDICTABLE_GAS_LIMIT") return "Transaction will likely fail. Please check your inputs and try again.";
  if (errorCode === "NONCE_EXPIRED") return "Transaction nonce expired. Please try again.";
  if (errorCode === "REPLACEMENT_UNDERPRICED") return "Transaction underpriced. Please try again with higher gas.";
  if (errorCode === "NETWORK_ERROR") return "Network error. Please check your connection and try again.";
  if (errorCode === "TIMEOUT") return "Transaction timeout. It may still succeed - check the blockchain explorer.";

  if (errorMessage.includes("insufficient funds")) return "Insufficient ETH balance for this transaction";
  if (errorMessage.includes("execution reverted")) return "Transaction reverted. Please check requirements.";
  if (errorMessage.includes("user rejected")) return "Transaction was rejected";

  return errorMessage || "Unknown Base blockchain error occurred";
}

function handleSolanaError(error: any): string {
  const errorMessage = error?.message || error?.toString() || "";

  if (errorMessage.includes("Insufficient SOL") || errorMessage.includes("insufficient funds")) {
    const match = errorMessage.match(/Your balance: ([\d.]+) SOL/);
    if (match) {
      return `Insufficient SOL balance. Your balance: ${match[1]} SOL. Please fund your wallet.`;
    }
    return "Insufficient SOL balance for this transaction";
  }

  if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
    return "Transaction timeout. It may still succeed on-chain - check Solscan explorer.";
  }
  if (errorMessage.includes("User not found")) return "User not registered. Please use /start to register first.";
  if (errorMessage.includes("already exists on-chain")) return errorMessage;
  if (errorMessage.includes("Blockhash not found")) return "Transaction expired. Please try again.";
  if (errorMessage.includes("custom program error")) return "Smart contract error. Please check requirements and try again.";
  if (errorMessage.includes("failed to send transaction")) return "Failed to send transaction. Please check your connection and try again.";
  if (errorMessage.includes("Account does not exist")) return "Account does not exist on-chain. Please verify the address.";
  if (errorMessage.includes("Transaction simulation failed")) return "Transaction simulation failed. Please check inputs and try again.";

  return errorMessage || "Unknown Solana blockchain error occurred";
}

function getGenericErrorMessage(error: any): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unknown error occurred";
}

export function isUserCancellation(error: any): boolean {
  const message = error?.message?.toLowerCase() || "";
  return message.includes("user rejected") || message.includes("user denied") || message.includes("cancelled");
}

export function isNetworkError(error: any): boolean {
  const code = error?.code || "";
  const message = error?.message?.toLowerCase() || "";
  return code === "NETWORK_ERROR" || message.includes("network") || message.includes("connection");
}

export function isInsufficientFunds(error: any): boolean {
  const code = error?.code || "";
  const message = error?.message?.toLowerCase() || "";
  return code === "INSUFFICIENT_FUNDS" || message.includes("insufficient funds") || message.includes("insufficient sol");
}
