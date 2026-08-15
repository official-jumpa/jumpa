import { Context, Markup } from "telegraf";
import getUser from "@features/users/getUserInfo";
import { getAllTokenBalances } from "@shared/utils/getTokenBalances";

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

    const hasSolanaWallet = user.solanaWallets && user.solanaWallets.length > 0;
    const hasEvmWallet = user.evmWallets && user.evmWallets.length > 0;

    if (!hasSolanaWallet && !hasEvmWallet) {
      await ctx.reply(
        "❌ You don't have any wallets yet. Please use /start to create or import a wallet."
      );
      return;
    }

    let walletMessage = "**Your Wallets**\n\n";

    if (hasSolanaWallet) {
      const solWallet = user.solanaWallets[0];
      const tokenBalances = await getAllTokenBalances(solWallet.address);

      walletMessage += `**Solana Wallet**\n\n`;
      walletMessage += ` **Address:** \`${solWallet.address}\`\n\n`;
      walletMessage += `SOL: ${solWallet.balance.toFixed(4)}   • USDC: ${tokenBalances.usdc.toFixed(1)}   • USDT: ${tokenBalances.usdt.toFixed(1)}\n\n`;
      walletMessage += `📅 **Last Updated:** ${solWallet.last_updated_balance.toLocaleString()}\n\n`;
    }

    if (hasEvmWallet) {
      const evmWallet = user.evmWallets[0];
      walletMessage += `**EVM Wallet**\n\n`;
      walletMessage += `**Address:** \`${evmWallet.address}\`\n\n`;
      walletMessage += `ETH: ${evmWallet.balance.toFixed(4)}\n\n`;
      walletMessage += `📅 **Last Updated:** ${evmWallet.last_updated_balance.toLocaleString()}\n\n`;
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
