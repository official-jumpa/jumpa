/**
 * Blockchain Type Definitions
 * Defines the supported blockchain types and their configurations
 */

export enum BlockchainType {
  BASE = "base",
  SOLANA = "solana"
}

export interface BlockchainConfig {
  type: BlockchainType;
  displayName: string;
  nativeCurrency: string;
  addressPrefix?: string;
  explorerUrl: string;
  testnetExplorerUrl?: string;
}

export const BLOCKCHAIN_CONFIGS: Record<BlockchainType, BlockchainConfig> = {
  [BlockchainType.BASE]: {
    type: BlockchainType.BASE,
    displayName: "Base",
    nativeCurrency: "ETH",
    addressPrefix: "0x",
    explorerUrl: "https://basescan.org",
    testnetExplorerUrl: "https://sepolia.basescan.org"
  },
  [BlockchainType.SOLANA]: {
    type: BlockchainType.SOLANA,
    displayName: "Solana",
    nativeCurrency: "SOL",
    explorerUrl: "https://solscan.io",
    testnetExplorerUrl: "https://explorer.solana.com"
  }
};
