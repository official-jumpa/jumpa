/**
 * Blockchain Service Interface
 * Defines the contract that all blockchain implementations must follow
 */

import { BlockchainType } from "../types/BlockchainType";

export interface IBlockchainService {
  // ===== METADATA =====

  /**
   * Get the blockchain type for this service
   */
  getBlockchainType(): BlockchainType;

  /**
   * Get the native currency symbol (ETH, SOL, etc.)
   */
  getNativeCurrency(): string;

  /**
   * Validate if an address is valid for this blockchain
   */
  validateAddress(address: string): boolean;

  /**
   * Get the display name of the blockchain
   */
  getDisplayName(): string;
}
