import { config } from '@core/config/environment';

export interface SwitchBeneficiaryOfframp {
  holder_type: 'INDIVIDUAL' | 'BUSINESS';
  holder_name: string;
  account_number: string;
  bank_code: string;
}

export interface SwitchBeneficiaryOnramp {
  holder_type: 'INDIVIDUAL' | 'BUSINESS';
  holder_name: string;
  wallet_address: string;
}

export interface InitiateOfframpPayload {
  amount: number;
  country: string;
  asset: string;
  currency?: string;
  beneficiary: SwitchBeneficiaryOfframp;
  sender_name?: string;
  reference: string;
  callback_url?: string;
  channel?: string;
  reason?: string;
  developer_fee?: number;
  developer_recipient?: string;
  static?: boolean;
}

export interface InitiateOnrampPayload {
  amount: number;
  country: string;
  asset: string;
  currency?: string;
  beneficiary: SwitchBeneficiaryOnramp;
  reference: string;
  callback_url?: string;
  channel?: string;
  reason?: string;
  developer_fee?: number;
  developer_recipient?: string;
}

export interface SwitchApiResponse<T = any> {
  success: boolean;
  message: string;
  timestamp: string;
  status?: number;
  data: T;
}

const getBaseUrl = (): string => config.switchBaseUrl || 'https://api.onswitch.xyz';
const getApiKey = (): string => config.switchApiKey || '';

async function switchRequest<T = any>(
  path: string,
  options: {
    method?: string;
    params?: Record<string, string | number | boolean | undefined>;
    body?: any;
    apiKey?: string;
    baseUrl?: string;
  } = {}
): Promise<SwitchApiResponse<T>> {
  const baseUrl = options.baseUrl || getBaseUrl();
  const apiKey = options.apiKey || getApiKey();

  let url = `${baseUrl}${path}`;
  if (options.params) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null) {
        query.append(key, String(value));
      }
    }
    const queryString = query.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-service-key': apiKey,
  };

  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage = data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`;
    const err = new Error(errorMessage);
    (err as any).response = { data, status: response.status, text: () => Promise.resolve(JSON.stringify(data)) };
    throw err;
  }

  return data as SwitchApiResponse<T>;
}

/**
 * Check if a currency is supported for Switch offramp (bank deposit).
 * Switch offramp only supports stablecoins (USDC, USDT, CNGN).
 */
export function isOfframpSupported(currency: string): boolean {
  const norm = (currency || '').toUpperCase();
  return norm === 'USDC' || norm === 'USDT' || norm === 'CNGN';
}

/**
 * Helper to format chain and currency into Switch asset code format (e.g. solana:usdc, base:usdc)
 */
export function formatAssetCode(chain: string, currency: string): string {
  const normChain = (chain || 'BASE').toLowerCase();
  const normCurrency = (currency || 'USDC').toLowerCase();

  if (normChain === 'solana' || normChain === 'sol') {
    return `solana:${normCurrency}`;
  }
  if (normChain === 'base') {
    return `base:${normCurrency}`;
  }
  if (normChain === 'ethereum' || normChain === 'eth') {
    return `ethereum:${normCurrency}`;
  }
  if (normChain === 'polygon') {
    return `polygon:${normCurrency}`;
  }
  if (normChain === 'bsc' || normChain === 'binance') {
    return `bsc:${normCurrency}`;
  }
  if (normChain === 'arbitrum') {
    return `arbitrum:${normCurrency}`;
  }
  if (normChain === 'optimism') {
    return `optimism:${normCurrency}`;
  }

  return `${normChain}:${normCurrency}`;
}

/**
 * Get field requirements for Onramp/Offramp
 */
export async function getRequirements(
  direction: 'ONRAMP' | 'OFFRAMP',
  country: string = 'NG',
  currency?: string
): Promise<SwitchApiResponse> {
  return switchRequest('/requirement', {
    method: 'GET',
    params: { direction, country, currency },
  });
}

/**
 * Fetch current offramp rate
 */
export async function getOfframpRate(
  country: string = 'NG',
  currency: string = 'NGN',
  asset?: string
): Promise<SwitchApiResponse<{ currency: string; channel: string; rate: number }>> {
  return switchRequest('/offramp/rate', {
    method: 'POST',
    body: {
      country,
      currency,
      ...(asset ? { asset } : {}),
    },
  });
}

/**
 * Fetch current onramp rate
 */
export async function getOnrampRate(
  country: string = 'NG',
  currency: string = 'NGN',
  asset?: string
): Promise<SwitchApiResponse<{ currency: string; channel: string; rate: number }>> {
  return switchRequest('/onramp/rate', {
    method: 'POST',
    body: {
      country,
      currency,
      ...(asset ? { asset } : {}),
    },
  });
}

/**
 * Get a real-time quote for an offramp transaction
 */
export async function getOfframpQuote(
  amount: number,
  country: string = 'NG',
  asset: string = 'base:usdc',
  currency: string = 'NGN'
): Promise<SwitchApiResponse> {
  return switchRequest('/offramp/quote', {
    method: 'POST',
    body: {
      amount,
      country,
      asset,
      currency,
    },
  });
}

/**
 * Get a real-time quote for an onramp transaction
 */
export async function getOnrampQuote(
  amount: number,
  country: string = 'NG',
  asset: string = 'base:usdc',
  currency: string = 'NGN'
): Promise<SwitchApiResponse> {
  return switchRequest('/onramp/quote', {
    method: 'POST',
    body: {
      amount,
      country,
      asset,
      currency,
    },
  });
}

/**
 * Initiate an offramp (crypto -> fiat) transaction
 */
export async function initiateOfframp(payload: InitiateOfframpPayload): Promise<SwitchApiResponse> {
  return switchRequest('/offramp/initiate', {
    method: 'POST',
    body: payload,
  });
}

/**
 * Initiate an onramp (fiat -> crypto) transaction
 */
export async function initiateOnramp(payload: InitiateOnrampPayload): Promise<SwitchApiResponse> {
  return switchRequest('/onramp/initiate', {
    method: 'POST',
    body: payload,
  });
}

/**
 * Confirm offramp payment deposit with blockchain transaction hash
 */
export async function confirmDeposit(reference: string, hash: string): Promise<SwitchApiResponse> {
  return switchRequest('/confirm', {
    method: 'POST',
    body: {
      reference,
      hash,
    },
  });
}

/**
 * Check transaction status by reference UUID
 */
export async function getStatus(reference: string): Promise<SwitchApiResponse> {
  return switchRequest('/status', {
    method: 'GET',
    params: { reference },
  });
}

export const switchService = {
  isOfframpSupported,
  formatAssetCode,
  getRequirements,
  getOfframpRate,
  getOnrampRate,
  getOfframpQuote,
  getOnrampQuote,
  initiateOfframp,
  initiateOnramp,
  confirmDeposit,
  getStatus,
};

export default switchService;
