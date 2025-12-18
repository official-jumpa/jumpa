/**
 * Response Mapper Utilities
 * Maps blockchain-specific responses to common format
 */

import { BlockchainType } from "../types/BlockchainType";
import { GroupInfo, GroupState, TransactionResult } from "../types/CommonTypes";
import { BlockchainDetector } from "./blockchainDetector";

export class ResponseMapper {
  /**
   * Normalize group info from Base blockchain
   */
  static normalizeBaseGroupInfo(data: any): GroupInfo {
    return {
      groupAddress: data.groupAddress,
      name: data.name,
      isPrivate: data.isPrivate,
      state: this.mapBaseState(data.state),
      members: data.members || [],
      traders: data.traders || [],
      blacklist: data.blacklist || [],
      minimumDeposit: Number(data.minimumDeposit) / 1e18,
      totalContributions: Number(data.totalContributions) / 1e18,
      currency: "ETH",
      createdAt: new Date(data.createdAt * 1000),
      blockchain: BlockchainType.BASE,
      maxSlippagePercentage: data.maxSlippagePercentage,
      maxSwapPercentage: data.maxSwapPercentage
    };
  }

  /**
   * Normalize group info from Solana blockchain
   */
  static normalizeSolanaGroupInfo(data: any): GroupInfo {
    return {
      groupAddress: data.groupAddress || data.publicKey,
      name: data.name,
      isPrivate: data.isPrivate,
      state: this.mapSolanaState(data.state || data),
      members: data.members || [],
      traders: data.traders || [],
      blacklist: data.blacklist || [],
      minimumDeposit: parseFloat(data.minimumDeposit || 0) / 1e9,
      totalContributions: parseFloat(data.totalContributions || 0) / 1e9,
      currency: "SOL",
      createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt),
      blockchain: BlockchainType.SOLANA,
      exitPenaltyPercentage: data.exitPenaltyPercentage,
      lockPeriodDays: data.lockPeriodDays
    };
  }

  /**
   * Map Base state to GroupState enum
   */
  private static mapBaseState(state: string | number): GroupState {
    const stateStr = state.toString();
    const stateMap: Record<string, GroupState> = {
      "0": GroupState.OPEN,
      "1": GroupState.TRADING,
      "2": GroupState.CLOSED,
      "3": GroupState.PAUSED
    };
    return stateMap[stateStr] || GroupState.OPEN;
  }

  /**
   * Map Solana state to GroupState enum
   */
  private static mapSolanaState(state: any): GroupState {
    if (state?.locked || state?.isLocked) {
      return GroupState.LOCKED;
    }
    if (state?.closed || state?.isClosed) {
      return GroupState.CLOSED;
    }
    if (state?.trading || state?.isTrading) {
      return GroupState.TRADING;
    }
    return GroupState.OPEN;
  }

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
