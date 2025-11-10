import getUser from "@modules/users/getUserInfo";
import { getAllTokenBalances } from "@shared/utils/getTokenBalances";
import { getAllEvmBalances } from "@shared/utils/getEvmBalances";

export interface UserBalances {
  solana: {
    sol: number;
    usdc: number;
    usdt: number;
    address: string;
  } | null;
  evm: {
    celo: {
      eth: number;
      usdc: number;
      usdt: number;
    };
    base: {
      eth: number;
      usdc: number;
      usdt: number;
    };
    address: string;
  } | null;
}

/**
 * Fetch user's wallet balances across all chains
 * @param telegramId - User's telegram ID
 * @param username - User's username
 * @returns Object containing Solana and EVM balances
 */
export async function getUserBalances(
  telegramId: number,
  username: string
): Promise<UserBalances> {
  const user = await getUser(telegramId, username);

  if (!user) {
    throw new Error("User not found");
  }

  const balances: UserBalances = {
    solana: null,
    evm: null,
  };

  // Fetch Solana balances if wallet exists
  const hasSolanaWallet =
    user.solanaWallets &&
    user.solanaWallets.length > 0 &&
    user.solanaWallets[0].address;

  if (hasSolanaWallet) {
    const tokenBalances = await getAllTokenBalances(
      user.solanaWallets[0].address
    );

    balances.solana = {
      sol: user.solanaWallets[0].balance,
      usdc: tokenBalances.usdc,
      usdt: tokenBalances.usdt,
      address: user.solanaWallets[0].address,
    };
  }

  // Fetch EVM balances if wallet exists
  const hasEvmWallet =
    user.evmWallets &&
    user.evmWallets.length > 0 &&
    user.evmWallets[0].address;

  if (hasEvmWallet) {
    const evmBalances = await getAllEvmBalances(user.evmWallets[0].address);

    balances.evm = {
      celo: {
        eth: evmBalances.CELO.eth,
        usdc: evmBalances.CELO.usdc,
        usdt: evmBalances.CELO.usdt,
      },
      base: {
        eth: evmBalances.BASE.eth,
        usdc: evmBalances.BASE.usdc,
        usdt: evmBalances.BASE.usdt,
      },
      address: user.evmWallets[0].address,
    };
  }

  return balances;
}

/**
 * Format user balances into a readable string
 * @param balances - User balances object
 * @returns Formatted balance string
 */
export function formatBalances(balances: UserBalances): string {
  let message = "";

  if (balances.solana) {
    message += `<b>--- Your Solana Wallet ---</b>\n\n`;
    message += `<code>${balances.solana.address}</code>\n\n`;
    message += `SOL: ${balances.solana.sol.toFixed(4)}   • USDC: ${balances.solana.usdc.toFixed(1)}   • USDT: ${balances.solana.usdt.toFixed(1)}\n`;
  }

  if (balances.evm) {
    message += `\n<b>--- Your EVM Wallet ---</b>\n\n`;
    message += `<code>${balances.evm.address}</code>\n\n`;
    message += `<b>Celo:</b>\n`;
    message += `ETH: ${balances.evm.celo.eth.toFixed(4)}   • USDC: ${balances.evm.celo.usdc.toFixed(2)}   • USDT: ${balances.evm.celo.usdt.toFixed(2)}\n\n`;
    message += `<b>Base:</b>\n`;
    message += `ETH: ${balances.evm.base.eth.toFixed(4)}   • USDC: ${balances.evm.base.usdc.toFixed(2)}   • USDT: ${balances.evm.base.usdt.toFixed(2)}\n`;
  }

  return message;
}
