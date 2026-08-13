import * as StellarSdk from "@stellar/stellar-sdk";
import User from "@core/database/models/user";

// Horizon RPC endpoints
const STELLAR_MAINNET_HORIZON = "https://horizon.stellar.org";
const STELLAR_TESTNET_HORIZON = "https://horizon-testnet.stellar.org";

// Official Circle USDC Issuers on Stellar
export const STELLAR_MAINNET_USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
export const STELLAR_TESTNET_USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export interface StellarBalances {
  xlm: number;
  usdc: number;
}

const CACHE_DURATION = 0.2 * 60 * 1000; // 12 seconds cache

/**
 * Fetches XLM and USDC balances from Stellar Horizon RPC endpoint
 * @param walletAddress - Public key address (G... format)
 * @param isTestnet - Whether to query testnet Horizon server
 */
export async function fetchStellarBalancesFromRpc(
  walletAddress: string,
  isTestnet = false
): Promise<StellarBalances> {
  const horizonUrl = isTestnet ? STELLAR_TESTNET_HORIZON : STELLAR_MAINNET_HORIZON;
  const usdcIssuer = isTestnet ? STELLAR_TESTNET_USDC_ISSUER : STELLAR_MAINNET_USDC_ISSUER;
  const server = new StellarSdk.Horizon.Server(horizonUrl);

  try {
    const account = await server.loadAccount(walletAddress);

    // Extract native XLM balance
    const nativeBal = account.balances.find(
      (b: any) => b.asset_type === "native"
    );
    const xlm = nativeBal ? parseFloat(nativeBal.balance) : 0;

    // Extract Circle USDC balance
    const usdcBal = account.balances.find(
      (b: any) => b.asset_code === "USDC" && b.asset_issuer === usdcIssuer
    );
    const usdc = usdcBal ? parseFloat(usdcBal.balance) : 0;

    return { xlm, usdc };
  } catch (err: any) {
    const status = err?.response?.status;
    const isNotFoundOrInvalid = status === 404 || status === 400 || err?.message?.includes("Not Found");
    
    if (isNotFoundOrInvalid) {
      return { xlm: 0, usdc: 0 };
    }
    console.error(`[Stellar Balances] Failed to fetch for ${walletAddress}:`, err?.message || err);
    return { xlm: 0, usdc: 0 };
  }
}

/**
 * Get Stellar balances with caching and database synchronization
 */
export default async function getStellarBalances(
  walletAddress: string,
  forceRefresh = false,
  isTestnet = false
): Promise<StellarBalances> {
  try {
    const user = await User.findOne({
      "stellarWallets.address": walletAddress,
    }).exec();

    if (user && user.stellarWallets && user.stellarWallets.length > 0) {
      const wallet = user.stellarWallets.find((w) => w.address === walletAddress);

      if (wallet) {
        const now = Date.now();
        const lastUpdated = wallet.last_updated_balance?.getTime() || 0;
        const cacheAge = now - lastUpdated;
        const isCacheValid = cacheAge < CACHE_DURATION && !forceRefresh;

        if (isCacheValid && wallet.balance !== undefined) {
          return {
            xlm: wallet.balance || 0,
            usdc: wallet.usdcBalance || 0,
          };
        }
      }
    }

    // Fetch fresh balance from Horizon RPC
    const freshBalances = await fetchStellarBalancesFromRpc(walletAddress, isTestnet);

    // Cache updated balances in DB if user exists
    if (user) {
      const walletIndex = user.stellarWallets.findIndex(
        (w) => w.address === walletAddress
      );
      if (walletIndex !== -1) {
        await User.findOneAndUpdate(
          { "stellarWallets.address": walletAddress },
          {
            $set: {
              [`stellarWallets.${walletIndex}.balance`]: freshBalances.xlm,
              [`stellarWallets.${walletIndex}.usdcBalance`]: freshBalances.usdc,
              [`stellarWallets.${walletIndex}.last_updated_balance`]: new Date(),
            },
          }
        ).exec();
      }

      // Auto-ensure USDC trustline if account has XLM >= 1.5
      if (freshBalances.xlm >= 1.5) {
        import("./ensureStellarTrustline").then(({ ensureStellarTrustline }) => {
          ensureStellarTrustline(user, isTestnet).catch(() => {});
        });
      }
    }

    return freshBalances;
  } catch (error) {
    console.error("Error in getStellarBalances:", error);
    return { xlm: 0, usdc: 0 };
  }
}
