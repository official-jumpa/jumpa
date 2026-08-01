/**
 * Common Types for Cross-Chain Operations
 * These types provide a unified interface across different blockchains
 */

import { BlockchainType } from "./BlockchainType";

export interface BlockchainResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  transactionHash?: string;
  blockNumber?: number;  // Base only
  slot?: number;         // Solana only
}

/**
 * Transaction result normalized across blockchains
 */
export interface TransactionResult {
  success: boolean;
  transactionHash: string;
  blockNumber?: number;            // Base only
  slot?: number;                   // Solana only
  explorerUrl: string;
}
