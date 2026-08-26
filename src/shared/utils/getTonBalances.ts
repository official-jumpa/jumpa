import { TonClient, fromNano } from "@ton/ton";
import { Address, beginCell } from "@ton/core";
import { config } from "@core/config/environment";
import User from "@core/database/models/user";

// Official Tether USD (USDT) Jetton Master on TON Mainnet
export const TON_MAINNET_USDT_MASTER = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";

export interface TonBalances {
  ton: number;
  usdt: number;
}

const CACHE_DURATION = 0.2 * 60 * 1000; // 12 seconds cache

/**
 * Helper to get a TonClient instance
 */
export function getTonClient(isTestnet = false): TonClient {
  const endpoint = isTestnet ? config.tonTestnetRpcUrl : config.tonRpcUrl;

  return new TonClient({
    endpoint,
    apiKey: config.tonApiKey || undefined,
  });
}

/**
 * Fetches TON and Jetton (USDT) balances directly from TON RPC
 */
export async function fetchTonBalancesFromRpc(
  walletAddress: string,
  isTestnet = false
): Promise<TonBalances> {
  const client = getTonClient(isTestnet);

  try {
    const parsedAddress = Address.parse(walletAddress);

    // 1. Fetch native TON balance
    let ton = 0;
    try {
      const balanceNano = await client.getBalance(parsedAddress);
      ton = parseFloat(fromNano(balanceNano));
    } catch (err: any) {
      console.warn(`[TON Balances] Native balance query notice for ${walletAddress}:`, err?.message || err);
      ton = 0;
    }

    // 2. Fetch USDT Jetton balance (if mainnet)
    let usdt = 0;
    if (!isTestnet && TON_MAINNET_USDT_MASTER) {
      try {
        const usdtMasterAddress = Address.parse(TON_MAINNET_USDT_MASTER);
        // Call get_wallet_address on the USDT minter to get the user's Jetton wallet address
        const response = await client.runMethod(
          usdtMasterAddress,
          "get_wallet_address",
          [
            {
              type: "slice",
              cell: beginCell().storeAddress(parsedAddress).endCell(),
            },
          ]
        );

        const jettonWalletAddress = response.stack.readAddress();

        // Check if the Jetton wallet is deployed / has balance
        const jettonData = await client.runMethod(
          jettonWalletAddress,
          "get_wallet_data"
        );
        const jettonBalanceRaw = jettonData.stack.readBigNumber();
        // USDT on TON has 6 decimals
        usdt = Number(jettonBalanceRaw) / 1e6;
      } catch (jettonErr) {
        // Normal if user has never received USDT or Jetton wallet is uninitialized
        usdt = 0;
      }
    }

    return { ton, usdt };
  } catch (error: any) {
    console.error(`[TON Balances] Failed to fetch balances for ${walletAddress}:`, error?.message || error);
    return { ton: 0, usdt: 0 };
  }
}

/**
 * Get TON balances with caching and database synchronization
 */
export default async function getTonBalances(
  walletAddress: string,
  forceRefresh = false,
  isTestnet = false
): Promise<TonBalances> {
  try {
    const user = await User.findOne({
      "tonWallets.address": walletAddress,
    }).exec();

    if (user && user.tonWallets && user.tonWallets.length > 0) {
      const wallet = user.tonWallets.find(
        (w) => w.address === walletAddress || (w as any).rawAddress === walletAddress
      );

      if (wallet) {
        const now = Date.now();
        const lastUpdated = wallet.last_updated_balance?.getTime() || 0;
        const cacheAge = now - lastUpdated;
        const isCacheValid = cacheAge < CACHE_DURATION && !forceRefresh;

        if (isCacheValid && wallet.balance !== undefined) {
          return {
            ton: wallet.balance || 0,
            usdt: wallet.usdtBalance || 0,
          };
        }
      }
    }

    // Fetch fresh balances from TON RPC
    const freshBalances = await fetchTonBalancesFromRpc(walletAddress, isTestnet);

    // Cache updated balances in DB if user exists
    if (user) {
      const walletIndex = user.tonWallets.findIndex(
        (w) => w.address === walletAddress || (w as any).rawAddress === walletAddress
      );
      if (walletIndex !== -1) {
        await User.findOneAndUpdate(
          { "tonWallets.address": walletAddress },
          {
            $set: {
              [`tonWallets.${walletIndex}.balance`]: freshBalances.ton,
              [`tonWallets.${walletIndex}.usdtBalance`]: freshBalances.usdt,
              [`tonWallets.${walletIndex}.last_updated_balance`]: new Date(),
            },
          }
        ).exec();
      }
    }

    return freshBalances;
  } catch (error) {
    console.error("Error in getTonBalances:", error);
    return { ton: 0, usdt: 0 };
  }
}
