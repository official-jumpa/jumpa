import { formatAssetCode, getOfframpRate } from '@features/payments/services/switchService';

/**
 * Converts NGN amount to cryptocurrency amount using current Switch exchange rates
 * @param ngnAmount - Amount in Nigerian Naira
 * @param currency - Target cryptocurrency (SOL, USDC, USDT, ETH, CELO)
 * @param chain - Blockchain (SOLANA, BASE, CELO)
 * @returns Crypto amount
 */
export async function convertNGNToCrypto(
  ngnAmount: number,
  currency: 'SOL' | 'USDC' | 'USDT' | 'ETH' | 'CELO',
  chain: 'SOLANA' | 'BASE' | 'CELO'
): Promise<number> {
  try {
    console.log(`[Currency Conversion] Converting ₦${ngnAmount} to ${currency} on ${chain}`);

    let usdToNgn = 1400; // Default fallback

    try {
      const assetCode = formatAssetCode(chain, currency);
      const switchRate = await getOfframpRate('NG', 'NGN', assetCode);
      if (switchRate?.data?.rate) {
        usdToNgn = switchRate.data.rate;
      }
    } catch (e: any) {
      console.warn('[Currency Conversion] Switch rate error', e?.message);
    }

    // Convert NGN to USD (1 USDC = 1 USD)
    const usdAmount = ngnAmount / usdToNgn;
    console.log(`[Currency Conversion] ₦${ngnAmount} = $${usdAmount.toFixed(2)} at 1 USD = ₦${usdToNgn}`);

    let cryptoAmount: number;
    if (currency === 'USDC' || currency === 'USDT') {
      cryptoAmount = usdAmount;
    } else {
      // For volatile assets (SOL, ETH, CELO), attempt rate fallback calculation
      cryptoAmount = usdAmount; // Default 1:1 if stable
    }

    const limitedAmount = parseFloat(cryptoAmount.toFixed(6));
    console.log(`[Currency Conversion] Final amount: ${limitedAmount} ${currency}`);

    return limitedAmount;
  } catch (error: any) {
    console.error('[Currency Conversion] Error:', error);
    throw new Error(`Failed to convert currency: ${error.message}`);
  }
}

/**
 * Get available currencies for a specific chain
 * @param chain - Blockchain (SOLANA, BASE, CELO, STELLAR)
 * @returns Array of supported currencies
 */
export function getCurrenciesForChain(chain: 'SOLANA' | 'BASE' | 'CELO' | 'STELLAR' | 'TON'): string[] {
  if (chain === 'SOLANA') {
    return ['SOL', 'USDC', 'USDT'];
  } else if (chain === 'CELO') {
    return ['CELO', 'ETH', 'USDC', 'USDT'];
  } else if (chain === 'BASE') {
    return ['ETH', 'USDC', 'USDT'];
  } else if (chain === 'STELLAR') {
    return ['XLM', 'USDC'];
  } else if (chain === 'TON') {
    return ['TON', 'USDT'];
  }
  return [];
}

/**
 * Converts cryptocurrency amount to NGN using current exchange rates
 * @param cryptoAmount - Amount in cryptocurrency
 * @param currency - Cryptocurrency (SOL, USDC, USDT, ETH, CELO, XLM)
 * @param chain - Blockchain (SOLANA, BASE, CELO)
 * @returns NGN amount
 */
export async function convertCryptoToNGN(
  cryptoAmount: number,
  currency: 'SOL' | 'USDC' | 'USDT' | 'ETH' | 'CELO',
  chain: 'SOLANA' | 'BASE' | 'CELO'
): Promise<number> {
  try {
    let usdToNgn = 1400;

    try {
      const assetCode = formatAssetCode(chain, currency);
      const switchRate = await getOfframpRate('NG', 'NGN', assetCode);
      if (switchRate?.data?.rate) {
        usdToNgn = switchRate.data.rate;
      }
    } catch (e: any) {
      console.log("[Currency Conversion] Error: ", e);
    }

    const usdAmount = cryptoAmount; // 1 USDC/USDT = 1 USD
    const ngnAmount = usdAmount * usdToNgn;

    return Math.round(ngnAmount * 100) / 100;
  } catch (error: any) {
    console.error('[Currency Conversion] Error:', error);
    throw new Error(`Failed to convert currency: ${error.message}`);
  }
}
