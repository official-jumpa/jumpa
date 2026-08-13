/**
 * Blockchain Type Definitions & Contracts
 */

export enum BlockchainType {
  BASE = "base",
  SOLANA = "solana",
  STELLAR = "stellar"
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
    testnetExplorerUrl: "https://sepolia.basescan.org",
  },
  [BlockchainType.SOLANA]: {
    type: BlockchainType.SOLANA,
    displayName: "Solana",
    nativeCurrency: "SOL",
    explorerUrl: "https://solscan.io",
    testnetExplorerUrl: "https://explorer.solana.com",
  },
  [BlockchainType.STELLAR]: {
    type: BlockchainType.STELLAR,
    displayName: "Stellar",
    nativeCurrency: "XLM",
    explorerUrl: "https://stellar.expert/explorer/public",
    testnetExplorerUrl: "https://stellar.expert/explorer/testnet",
  },
};

export interface BlockchainResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  transactionHash?: string;
  blockNumber?: number; // Base only
  slot?: number; // Solana only
}

export interface TransactionResult {
  success: boolean;
  transactionHash: string;
  blockNumber?: number; // Base only
  slot?: number; // Solana only
  explorerUrl: string;
}

export interface BlockchainService {
  getBlockchainType: () => BlockchainType;
  getNativeCurrency: () => string;
  validateAddress: (address: string) => boolean;
  getDisplayName: () => string;
}
