/**
 * Response Mapper Utilities
 * Maps blockchain-specific responses to common format
 */

import { BlockchainType } from "../types/BlockchainType";
import { TransactionResult } from "../types/CommonTypes";
import { BlockchainDetector } from "./blockchainDetector";

export class ResponseMapper {

  /**
   * Normalize transaction result
   */
  static normalizeTransactionResult(
    txHash: string,
    blockchain: BlockchainType,
    blockNumber?: number,
    slot?: number,
    isTestnet: boolean = false
  ): TransactionResult {
    return {
      success: true,
      transactionHash: txHash,
      blockNumber,
      slot,
      explorerUrl: BlockchainDetector.getExplorerUrl(blockchain, txHash, isTestnet)
    };
  }

  /**
   * Convert wei to ETH
   */
  static weiToEth(wei: string | number): number {
    return Number(wei) / 1e18;
  }

  /**
   * Convert lamports to SOL
   */
  static lamportsToSol(lamports: string | number): number {
    return Number(lamports) / 1e9;
  }

  /**
   * Convert ETH to wei
   */
  static ethToWei(eth: number): string {
    return (eth * 1e18).toString();
  }

  /**
   * Convert SOL to lamports
   */
  static solToLamports(sol: number): string {
    return (sol * 1e9).toString();
  }
}
