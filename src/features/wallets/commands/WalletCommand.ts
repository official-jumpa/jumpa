import { Context, Markup } from "telegraf";
import getUser from "@features/users/getUserInfo";
import { getAllTokenBalances } from "@shared/utils/getTokenBalances";
import getStellarBalances from "@shared/utils/getStellarBalances";
import getTonBalances from "@shared/utils/getTonBalances";

export const walletCommandConfig = {
  name: "wallet",
  description: "Show wallet information and options",
};

export async function handleWalletCommand(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

    if (!telegramId) {
      await ctx.reply("❌ Unable to identify your Telegram account.");
      return;
    }

    const user = await getUser(telegramId, username);

    if (!user) {
      await ctx.reply(
        "❌ User not found. Please use /start to register first."
      );
      return;
    }

    const solanaWallets = user.solanaWallets || [];
    const evmWallets = user.evmWallets || [];
    const stellarWallets = user.stellarWallets || [];
    const tonWallets = user.tonWallets || [];

    const hasSolanaWallet =
      solanaWallets.length > 0 && !!solanaWallets[0].address;
    const hasEvmWallet =
      evmWallets.length > 0 && !!evmWallets[0].address;
    const hasStellarWallet =
      stellarWallets.length > 0 && !!stellarWallets[0].address;
    const hasTonWallet =
      tonWallets.length > 0 && !!tonWallets[0].address;

    if (!hasSolanaWallet && !hasEvmWallet && !hasStellarWallet && !hasTonWallet) {
      await ctx.reply(
        "❌ You don't have any wallets yet. Please use /start to create or import a wallet."
      );
      return;
    }

    const [tokenBalances, stellarBalances, tonBalances] = await Promise.all([
      hasSolanaWallet
        ? getAllTokenBalances(solanaWallets[0].address)
        : Promise.resolve({ usdc: 0, usdt: 0 }),
      hasStellarWallet
        ? getStellarBalances(stellarWallets[0].address)
        : Promise.resolve({ xlm: 0, usdc: 0 }),
      hasTonWallet
        ? getTonBalances(tonWallets[0].address)
        : Promise.resolve({ ton: 0, usdt: 0 }),
    ]);

    let walletMessage = "**Your Wallets**\n\n";

    if (hasSolanaWallet) {
      const solWallet = solanaWallets[0];
      const solBalance = solWallet.balance ?? 0;
      const lastUpdated = solWallet.last_updated_balance
        ? new Date(solWallet.last_updated_balance).toLocaleString()
        : new Date().toLocaleString();

      walletMessage += `**Solana Wallet**\n\n`;
      walletMessage += ` **Address:** \`${solWallet.address}\`\n\n`;
      walletMessage += `SOL: ${solBalance.toFixed(4)}   • USDC: ${tokenBalances.usdc.toFixed(1)}   • USDT: ${tokenBalances.usdt.toFixed(1)}\n\n`;
      walletMessage += `📅 **Last Updated:** ${lastUpdated}\n\n`;
    }

    if (hasEvmWallet) {
      const evmWallet = evmWallets[0];
      const evmBalance = evmWallet.balance ?? 0;
      const lastUpdated = evmWallet.last_updated_balance
        ? new Date(evmWallet.last_updated_balance).toLocaleString()
        : new Date().toLocaleString();

      walletMessage += `**EVM Wallet**\n\n`;
      walletMessage += `**Address:** \`${evmWallet.address}\`\n\n`;
      walletMessage += `ETH: ${evmBalance.toFixed(4)}\n\n`;
      walletMessage += `📅 **Last Updated:** ${lastUpdated}\n\n`;
    }

    if (hasStellarWallet) {
      const stellarWallet = stellarWallets[0];
      const lastUpdated = stellarWallet.last_updated_balance
        ? new Date(stellarWallet.last_updated_balance).toLocaleString()
        : new Date().toLocaleString();

      walletMessage += `**Stellar Wallet**\n\n`;
      walletMessage += `**Address:** \`${stellarWallet.address}\`\n\n`;
      walletMessage += `XLM: ${stellarBalances.xlm.toFixed(4)}   • USDC: ${stellarBalances.usdc.toFixed(1)}\n\n`;
      walletMessage += `📅 **Last Updated:** ${lastUpdated}\n\n`;
    }

    if (hasTonWallet) {
      const tonWallet = tonWallets[0];
      const lastUpdated = tonWallet.last_updated_balance
        ? new Date(tonWallet.last_updated_balance).toLocaleString()
        : new Date().toLocaleString();

      walletMessage += `**TON Wallet**\n\n`;
      walletMessage += `**Address:** \`${tonWallet.address}\`\n\n`;
      walletMessage += `TON: ${tonBalances.ton.toFixed(4)}   • USDT: ${tonBalances.usdt.toFixed(1)}\n\n`;
      walletMessage += `📅 **Last Updated:** ${lastUpdated}\n\n`;
    }

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback("🔄 Refresh Balance", "refresh_wallet"),
      ],
      [
        Markup.button.callback("🔐 Export Private Key", "show_private_key"),
        Markup.button.callback("📊 Wallet Details", "wallet_details"),
      ],
      [Markup.button.callback("❌ Close", "close_wallet")],
    ]);

    await ctx.reply(walletMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    console.error("Wallet command error:", error);
    await ctx.reply(
      "❌ An error occurred while fetching wallet information. Please try again later."
    );
  }
}
