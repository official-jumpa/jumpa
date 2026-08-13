/**
 * Blockchain Services & Factory
 */

import { BlockchainType, BlockchainService } from "./types";
import {
  detectBlockchainType,
  getNativeCurrency,
  validateAddress,
  getDisplayName,
} from "./detector";

/**
 * Base Blockchain Service Factory
 */
export const createBaseBlockchainService = (): BlockchainService => ({
  getBlockchainType: () => BlockchainType.BASE,
  getNativeCurrency: () => getNativeCurrency(BlockchainType.BASE),
  validateAddress: (address: string) => validateAddress(address, BlockchainType.BASE),
  getDisplayName: () => getDisplayName(BlockchainType.BASE),
});

/**
 * Solana Blockchain Service Factory
 */
export const createSolanaBlockchainService = (): BlockchainService => ({
  getBlockchainType: () => BlockchainType.SOLANA,
  getNativeCurrency: () => getNativeCurrency(BlockchainType.SOLANA),
  validateAddress: (address: string) => validateAddress(address, BlockchainType.SOLANA),
  getDisplayName: () => getDisplayName(BlockchainType.SOLANA),
});

/**
 * Stellar Blockchain Service Factory
 */
export const createStellarBlockchainService = (): BlockchainService => ({
  getBlockchainType: () => BlockchainType.STELLAR,
  getNativeCurrency: () => getNativeCurrency(BlockchainType.STELLAR),
  validateAddress: (address: string) => validateAddress(address, BlockchainType.STELLAR),
  getDisplayName: () => getDisplayName(BlockchainType.STELLAR),
});

// Singleton instance cache
const services: Record<BlockchainType, BlockchainService> = {
  [BlockchainType.BASE]: createBaseBlockchainService(),
  [BlockchainType.SOLANA]: createSolanaBlockchainService(),
  [BlockchainType.STELLAR]: createStellarBlockchainService(),
};

/**
 * Get blockchain service by address or blockchain type
 */
export function getBlockchainService(
  addressOrType: string | BlockchainType
): BlockchainService {
  let type: BlockchainType;

  if (
    addressOrType === BlockchainType.BASE ||
    addressOrType === BlockchainType.SOLANA ||
    addressOrType === BlockchainType.STELLAR
  ) {
    type = addressOrType as BlockchainType;
  } else if (typeof addressOrType === "string") {
    type = detectBlockchainType(addressOrType);
  } else {
    throw new Error(`Invalid blockchain type or address: ${addressOrType}`);
  }

  return services[type];
}

/**
 * Convenience method to get service by detecting blockchain from address
 */
export function detectAndGetService(address: string): BlockchainService {
  return getBlockchainService(address);
}
