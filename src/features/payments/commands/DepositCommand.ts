import { Context, Markup } from "telegraf";
import getUser from "@features/users/getUserInfo";
import { sendOrEdit } from "@shared/utils/messageHelper";

export const depositCommandConfig = {
  name: "deposit",
  description: "Deposit funds into your wallet",
};

export async function handleDepositCommand(ctx: Context): Promise<void> {
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery().catch(() => {});
    }

    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

    if (!telegramId) {
      await ctx.reply(
        "❌ Unable to identify your Telegram account. Please try again."
      );
      return;
    }

    const user = await getUser(telegramId, username);

    const hasSolanaWallet =
      user.solanaWallets &&
      user.solanaWallets.length > 0 &&
      user.solanaWallets[0].address;

    const hasEvmWallet =
      user.evmWallets &&
      user.evmWallets.length > 0 &&
      user.evmWallets[0].address;

    const hasStellarWallet =
      user.stellarWallets &&
      user.stellarWallets.length > 0 &&
      user.stellarWallets[0].address;

    let message = "*Deposit Funds*\n\n";

    if (!hasSolanaWallet && !hasEvmWallet && !hasStellarWallet) {
      message += "You haven't set up any wallets yet. Please use the /start command to create a wallet first.\n\n";
    } else {
      message += "You can deposit funds by sending crypto to your wallet addresses below:\n\n";

      if (hasSolanaWallet) {
        message += "*Solana*\n";
        message += `\`${user.solanaWallets[0].address}\`\n\n`;
      }

      if (hasEvmWallet) {
        message += "*Base / Celo*\n";
        message += `\`${user.evmWallets[0].address}\`\n\n`;
      }

      if (hasStellarWallet) {
        message += "*Stellar*\n";
        message += `\`${user.stellarWallets[0].address}\`\n\n`;
      }
    }

    message += "Or deposit from your Nigerian bank account 👇";

    await sendOrEdit(ctx, message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("Deposit from Bank", "deposit_from_bank"),
          Markup.button.callback("⬅️ Back", "back_to_menu"),
        ]
      ])
    });

  } catch (error) {
    console.error("Deposit command error:", error);
    await ctx.reply(
      "❌ An error occurred while fetching your deposit options."
    );
  }
}
