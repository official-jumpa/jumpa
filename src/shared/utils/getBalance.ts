import User from "@core/database/models/user";
import { config } from "@core/config/environment";

// Use Alchemy RPC endpoint (fallback to solMainnet if not set)
const RPC_ENDPOINT = config.alchemyMainnetRpc;
// Cache duration in milliseconds (20 secs) - matches token balance cache
const CACHE_DURATION = 0.2 * 60 * 1000;

/**
 * Fetches SOL balance via direct HTTP JSON-RPC call
 * @param walletAddress - The Solana wallet address
 * @returns Balance in lamports
 */
async function fetchBalanceViaHTTP(walletAddress: string): Promise<number> {
  console.log("get single token balance called")
  const response = await fetch(RPC_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [walletAddress]
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  return data.result.value; // Returns balance in lamports
}

/**
 * Get SOL balance for a Solana wallet address with caching support
 * @param walletAddress - The Solana wallet address
 * @param forceRefresh - Force refresh even if cache is valid (default: false)
 * @returns SOL balance as a number
 */
async function getBalance(walletAddress: string, forceRefresh: boolean = false): Promise<number> {
  try {
    // Find user with this wallet address
    const user = await User.findOne({
      'solanaWallets.address': walletAddress
    }).exec();

    if (user) {
      // Find the specific wallet
      const walletIndex = user.solanaWallets.findIndex(w => w.address === walletAddress);

      if (walletIndex !== -1) {
        const wallet = user.solanaWallets[walletIndex];

        // Check if cache is still valid
        const now = Date.now();
        const lastUpdated = wallet.last_updated_balance?.getTime() || 0;
        const cacheAge = now - lastUpdated;
        const isCacheValid = cacheAge < CACHE_DURATION && !forceRefresh;

        if (isCacheValid && wallet.balance !== undefined) {
          console.log(`Using cached SOL balance for ${walletAddress} (age: ${Math.round(cacheAge / 1000)}s)`);
          return wallet.balance;
        }
      }
    }

    // Cache expired, not found, or force refresh - fetch fresh data
    console.log(`Fetching fresh SOL balance for ${walletAddress} via HTTP`);
    const balanceLamports = await fetchBalanceViaHTTP(walletAddress);
    const userBalance = balanceLamports / 1e9;

    // Update cache in database if user exists
    if (user) {
      const walletIndex = user.solanaWallets.findIndex(w => w.address === walletAddress);
      if (walletIndex !== -1) {
        await User.findOneAndUpdate(
          { 'solanaWallets.address': walletAddress },
          {
            $set: {
              [`solanaWallets.${walletIndex}.balance`]: userBalance,
              [`solanaWallets.${walletIndex}.last_updated_balance`]: new Date()
            }
          }
        ).exec();
      }
    }

    return userBalance;
  } catch (error) {
    console.error('Error fetching SOL balance:', error);

    // Try to return cached value on error
    try {
      const user = await User.findOne({
        'solanaWallets.address': walletAddress
      });

      if (user) {
        const wallet = user.solanaWallets.find(w => w.address === walletAddress);
        if (wallet && wallet.balance !== undefined) {
          console.log(`Returning cached SOL balance after error for ${walletAddress}`);
          return wallet.balance;
        }
      }
    } catch (dbError) {
      console.error('Error retrieving cached SOL balance:', dbError);
    }

    throw error;
  }
}

export default getBalance;
// getBalance('8R8eZLAvB5A9QyByszPZ7bVJsBkdAPU1CYmpAHrdBG97')
