/**
 * Solana Blockchain Service
 * Implements IBlockchainService for Solana blockchain
 */

import { IBlockchainService } from "../shared/interfaces/IBlockchainService";
import { BlockchainType } from "../shared/types/BlockchainType";
import { BlockchainDetector } from "../shared/utils";

export class SolanaBlockchainService implements IBlockchainService {
  // ===== METADATA =====

  getBlockchainType(): BlockchainType {
    return BlockchainType.SOLANA;
  }

  getNativeCurrency(): string {
    return BlockchainDetector.getNativeCurrency(BlockchainType.SOLANA);
  }

  validateAddress(address: string): boolean {
    return BlockchainDetector.validateAddress(address, BlockchainType.SOLANA);
  }

  getDisplayName(): string {
    return BlockchainDetector.getDisplayName(BlockchainType.SOLANA);
  }
}
