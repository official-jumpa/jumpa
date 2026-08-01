/**
 * Base Blockchain Service
 * Implements IBlockchainService for Base (EVM) blockchain
 */

import { IBlockchainService } from "../shared/interfaces/IBlockchainService";
import { BlockchainType } from "../shared/types/BlockchainType";
import { BlockchainDetector } from "../shared/utils";

export class BaseBlockchainService implements IBlockchainService {
  // ===== METADATA =====

  getBlockchainType(): BlockchainType {
    return BlockchainType.BASE;
  }

  getNativeCurrency(): string {
    return BlockchainDetector.getNativeCurrency(BlockchainType.BASE);
  }

  validateAddress(address: string): boolean {
    return BlockchainDetector.validateAddress(address, BlockchainType.BASE);
  }

  getDisplayName(): string {
    return BlockchainDetector.getDisplayName(BlockchainType.BASE);
  }
}
