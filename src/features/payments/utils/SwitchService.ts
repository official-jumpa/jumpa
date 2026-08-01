import { config } from "@core/config/environment";
import User from "@core/database/models/user";

export interface OnRampResponse {
  success: boolean;
  status: number;
  message: string;
  data?: {
    deposit: {
      bank_name: string;
      bank_code: string;
      account_name: string;
      account_number: string;
      note: string[];
    };
    reference: string;
    destination: {
      amount: number;
      currency: string;
    };
  };
  error?: string;
}

export interface QuoteResponse {
  success: boolean;
  data?: {
    rate: number;
    destination: {
      amount: number;
      currency: string;
    };
  };
  message?: string;
}

const SWITCH_BASE_URL = "https://api.onswitch.xyz";

function getSwitchHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Service-Key": config.switchApiKey || "",
  };
}

function getWalletAddressForAsset(asset: string, user: any): string {
  const isSolana = asset.startsWith("solana:");

  if (isSolana) {
    return user.solanaWallets?.[0]?.address || "";
  } else {
    // Base / EVM
    return user.evmWallets?.[0]?.address || "";
  }
}

export async function initiateOnRamp(
  amount: number,
  asset: string,
  user: any
): Promise<OnRampResponse> {
  try {
    const payload = {
      amount: amount,
      country: "NG",
      currency: "NGN",
      asset: asset,
      beneficiary: {
        holder_type: "INDIVIDUAL",
        holder_name: user.username || `User ${user.telegram_id}`,
        wallet_address: getWalletAddressForAsset(asset, user),
      },
      exact_output: false,
      rail: "NIBSS",
    };

    console.log("[SwitchService] Initiating onramp:", JSON.stringify(payload, null, 2));

    const response = await fetch(`${SWITCH_BASE_URL}/onramp/initiate`, {
      method: "POST",
      headers: getSwitchHeaders(),
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    console.log("[SwitchService] Onramp response:", JSON.stringify(responseData, null, 2));

    if (!response.ok || !responseData.success) {
      return {
        success: false,
        status: response.status,
        message: responseData.message || "Failed to initiate transaction",
        error: JSON.stringify(responseData),
      };
    }

    return responseData;
  } catch (error: any) {
    console.error("[SwitchService] Error initiating onramp:", error);
    return {
      success: false,
      status: 500,
      message: "Internal server error",
      error: error.message,
    };
  }
}

export async function getQuote(amount: number, asset: string): Promise<QuoteResponse> {
  try {
    const payload = {
      amount: amount,
      country: "NG",
      currency: "NGN",
      asset: asset,
      rail: "NIBSS",
      exact_output: false,
    };

    const response = await fetch(`${SWITCH_BASE_URL}/onramp/quote`, {
      method: "POST",
      headers: getSwitchHeaders(),
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok || !responseData.success) {
      return {
        success: false,
        message: responseData.message || "Failed to fetch quote",
      };
    }

    return responseData;
  } catch (error) {
    console.error("[SwitchService] Error fetching quote:", error);
    return {
      success: false,
      message: "Internal server error",
    };
  }
}
