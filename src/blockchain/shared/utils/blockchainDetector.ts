/**
 * Blockchain Detection Utilities
 * Provides methods to detect and validate blockchain types
 */

import { BlockchainType, BLOCKCHAIN_CONFIGS } from "../types/BlockchainType";
import { PublicKey } from "@solana/web3.js";

export class BlockchainDetector {
  /**
   * Detect blockchain type from address format
   */
  static detectBlockchainType(address: string): BlockchainType {
    if (!address) {
      throw new Error("Address is required for blockchain detection");
    }

    // Base addresses start with 0x and are 42 characters long
    if (address.startsWith("0x") && address.length === 42) {
      return BlockchainType.BASE;
    }

    // Solana addresses are base58 encoded, typically 32-44 characters
    // Try to validate as Solana address
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
  static validateAddress(address: string, type: BlockchainType): boolean {
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
  static getNativeCurrency(type: BlockchainType): string {
    return BLOCKCHAIN_CONFIGS[type].nativeCurrency;
  }

  /**
   * Get display name for blockchain type
   */
  static getDisplayName(type: BlockchainType): string {
    return BLOCKCHAIN_CONFIGS[type].displayName;
  }

  /**
   * Get blockchain explorer URL for transaction
   */
  static getExplorerUrl(type: BlockchainType, txHash: string, isTestnet: boolean = false): string {
    const config = BLOCKCHAIN_CONFIGS[type];
    const baseUrl = isTestnet && config.testnetExplorerUrl
      ? config.testnetExplorerUrl
      : config.explorerUrl;

    if (type === BlockchainType.BASE) {
      return `${baseUrl}/tx/${txHash}`;
    } else if (type === BlockchainType.SOLANA) {
      return `${baseUrl}/tx/${txHash}`;
    }

    return baseUrl;
  }

  /**
   * Check if blockchain type is supported
   */
  static isSupported(type: string): boolean {
    return Object.values(BlockchainType).includes(type as BlockchainType);
  }

  /**
   * Get blockchain configuration
   */
  static getConfig(type: BlockchainType) {
    return BLOCKCHAIN_CONFIGS[type];
  }
}
