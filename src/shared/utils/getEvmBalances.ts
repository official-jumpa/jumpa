import { ethers } from 'ethers';

// RPC URLs for supported chains
const CHAIN_RPC_URLS = {
  CELO: 'https://forno.celo.org',
  BASE: 'https://base-rpc.publicnode.com',
};

// Token contract addresses
const TOKEN_ADDRESSES = {
  CELO: {
    USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    USDT: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e'
  },
  BASE: {
    USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'
  }
};

// ERC-20 ABI (minimal - balanceOf function)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

export type ChainName = 'CELO' | 'BASE';

export interface ChainBalances {
  eth: number;
  usdc: number;
  usdt: number;
}

export interface AllChainBalances {
  CELO: ChainBalances;
  BASE: ChainBalances;
}

/**
 * Get ETH balance for an address on a specific chain
 */
async function getEthBalance(walletAddress: string, chain: ChainName): Promise<number> {
  try {
    const rpcUrl = CHAIN_RPC_URLS[chain];
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const balanceWei = await provider.getBalance(walletAddress);
    const balanceEth = parseFloat(ethers.formatEther(balanceWei));

    return balanceEth;
  } catch (error) {
    console.error(`Error fetching ETH balance on ${chain}:`, error);
    return 0;
  }
}

/**
 * Get ERC-20 token balance (USDC/USDT) for an address
 */
async function getTokenBalance(
  walletAddress: string,
  tokenAddress: string,
  chain: ChainName,
  decimals: number = 6
): Promise<number> {
  try {
    const rpcUrl = CHAIN_RPC_URLS[chain];
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(walletAddress);
    const formattedBalance = parseFloat(ethers.formatUnits(balance, decimals));

    return formattedBalance;
  } catch (error) {
    console.error(`Error fetching token balance on ${chain}:`, error);
    return 0;
  }
}

/**
 * Get all balances (ETH, USDC, USDT) for a wallet on a specific chain
 */
async function getChainBalances(walletAddress: string, chain: ChainName): Promise<ChainBalances> {
  try {
    const [eth, usdc, usdt] = await Promise.all([
      getEthBalance(walletAddress, chain),
      getTokenBalance(walletAddress, TOKEN_ADDRESSES[chain].USDC, chain, 6),
      getTokenBalance(walletAddress, TOKEN_ADDRESSES[chain].USDT, chain, 6)
    ]);

    return { eth, usdc, usdt };
  } catch (error) {
    console.error(`Error fetching balances on ${chain}:`, error);
    return { eth: 0, usdc: 0, usdt: 0 };
  }
}

/**
 * Get all balances across Celo and Base chains
 */
export async function getAllEvmBalances(walletAddress: string): Promise<AllChainBalances> {
  try {
    const [celoBalances, baseBalances] = await Promise.all([
      getChainBalances(walletAddress, 'CELO'),
      getChainBalances(walletAddress, 'BASE')
    ]);

    return {
      CELO: celoBalances,
      BASE: baseBalances
    };
  } catch (error) {
    console.error('Error fetching EVM balances:', error);
    return {
      CELO: { eth: 0, usdc: 0, usdt: 0 },
      BASE: { eth: 0, usdc: 0, usdt: 0 }
    };
  }
}
