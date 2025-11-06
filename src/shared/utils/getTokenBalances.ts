import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "@core/config/config";
import User from "@database/models/user";

const connection = new Connection(config.solMainnet, 'confirmed');

// Token mint addresses on Solana mainnet
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Get USDC balance for a Solana wallet address (internal - no caching)
 * @param walletAddress - The Solana wallet address
 * @returns USDC balance as a number
 */
async function fetchUSDCBalance(walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { mint: USDC_MINT }
    );

    if (tokenAccounts.value.length === 0) {
      return 0; // No USDC token account found
    }

    const balanceInfo = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
    return balanceInfo.uiAmount || 0;
  } catch (error) {
    console.error('Error fetching USDC balance:', error);
    throw error;
  }
}

/**
 * Get USDT balance for a Solana wallet address (internal - no caching)
 * @param walletAddress - The Solana wallet address
 * @returns USDT balance as a number
 */
async function fetchUSDTBalance(walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { mint: USDT_MINT }
    );

    if (tokenAccounts.value.length === 0) {
      return 0; // No USDT token account found
    }

    const balanceInfo = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
    return balanceInfo.uiAmount || 0;
  } catch (error) {
    console.error('Error fetching USDT balance:', error);
    throw error;
  }
}

/**
 * Get all SPL token balances (USDC and USDT) for a wallet with caching
 * @param walletAddress - The Solana wallet address
 * @param forceRefresh - Force refresh even if cache is valid (default: false)
 * @returns Object containing USDC and USDT balances
 */
export async function getAllTokenBalances(
  walletAddress: string,
  forceRefresh: boolean = false
): Promise<{
  usdc: number;
  usdt: number;
}> {
  try {
    // Find user with this wallet address - ensure we get fresh data
    const user = await User.findOne({
      'solanaWallets.address': walletAddress
    }).exec();

    if (!user) {
      console.warn(`User not found for wallet address: ${walletAddress}`);
      return { usdc: 0, usdt: 0 };
    }

    // Find the specific wallet
    const walletIndex = user.solanaWallets.findIndex(w => w.address === walletAddress);

    if (walletIndex === -1) {
      console.warn(`Wallet not found in user's wallets: ${walletAddress}`);
      return { usdc: 0, usdt: 0 };
    }

    const wallet = user.solanaWallets[walletIndex];

    // Check if cache is still valid
    const now = Date.now();
    const lastUpdated = wallet.last_updated_token_balance?.getTime() || 0;
    const cacheAge = now - lastUpdated;
    const isCacheValid = cacheAge < CACHE_DURATION && !forceRefresh;

    if (isCacheValid) {
      // Return cached values
      console.log(`Using cached token balances for ${walletAddress} (age: ${Math.round(cacheAge / 1000)}s) usdc - ${wallet.usdcBalance}, usdt - ${wallet.usdtBalance}`);
      return {
        usdc: wallet.usdcBalance || 0,
        usdt: wallet.usdtBalance || 0
      };
    }

    // Cache expired or force refresh - fetch fresh data
    console.log(`Fetching fresh token balances for ${walletAddress}`);
    const [usdc, usdt] = await Promise.all([
      fetchUSDCBalance(walletAddress),
      fetchUSDTBalance(walletAddress)
    ]);

    // Use findOneAndUpdate with atomic operation to avoid race conditions
    const updateResult = await User.findOneAndUpdate(
      {
        'solanaWallets.address': walletAddress
      },
      {
        $set: {
          [`solanaWallets.${walletIndex}.usdcBalance`]: usdc,
          [`solanaWallets.${walletIndex}.usdtBalance`]: usdt,
          [`solanaWallets.${walletIndex}.last_updated_token_balance`]: new Date()
        }
      },
      {
        new: true,
        runValidators: true
      }
    ).exec();

    if (updateResult) {
      console.log(`Token balances saved for ${walletAddress} at index ${walletIndex}: USDC=${usdc}, USDT=${usdt}`);
    } else {
      console.error(`Failed to update token balances for ${walletAddress}`);
    }

    return { usdc, usdt };
  } catch (error) {
    console.error('Error fetching token balances:', error);

    // Try to return cached values even if fetch failed
    try {
      const user = await User.findOne({
        'solanaWallets.address': walletAddress
      });

      if (user) {
        const wallet = user.solanaWallets.find(w => w.address === walletAddress);
        if (wallet) {
          console.log(`Returning cached values after fetch error for ${walletAddress}`);
          return {
            usdc: wallet.usdcBalance || 0,
            usdt: wallet.usdtBalance || 0
          };
        }
      }
    } catch (dbError) {
      console.error('Error retrieving cached token balances:', dbError);
    }

    return { usdc: 0, usdt: 0 };
  }
}
