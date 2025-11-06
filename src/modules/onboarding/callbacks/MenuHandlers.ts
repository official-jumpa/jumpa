import { Context } from "telegraf";
import getUser from "@modules/users/getUserInfo";
import { Markup } from "telegraf";
import { getAllTokenBalances } from "@shared/utils/getTokenBalances";

export class MenuHandlers {
  // Handle back to main menu callback
  static async handleBackToMenu(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("🏠 Back to Main Menu");

      const user = await getUser(telegramId, username);

      if (!user) {
        await ctx.reply(
          "❌ User not found. Please use /start to register first."
        );
        return;
      }

      // Check if user has a solana wallet
      const hasSolanaWallet =
        user.solanaWallets &&
        user.solanaWallets.length > 0 &&
        user.solanaWallets[0].address;

      if (!hasSolanaWallet) {
        // Show wallet setup options
        const setupMessage = `Welcome to Jumpa Bot, ${username}!

🔐 **Wallet Setup Required**

You need to set up a Solana wallet to continue.

Choose an option:`;

        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "🔑 Generate New Wallet",
              "generate_wallet"
            ),
            Markup.button.callback(
              "📥 Import Existing Wallet",
              "import_wallet"
            ),
          ],
        ]);

        await ctx.reply(setupMessage, {
          parse_mode: "Markdown",
          ...keyboard,
        });
        return;
      }
      // Fetch USDT and USDC token balance
      const tokenBalances = await getAllTokenBalances(user.solanaWallets[0].address);

      const welcomeMessage = `
 Welcome to Jumpa Bot, ${username}!

 Your Wallet: \`${user.solanaWallets[0].address}\`

 SOL: ${(user.solanaWallets[0].balance).toFixed(4)}   • USDC: ${tokenBalances.usdc.toFixed(1)}   • USDT: ${tokenBalances.usdt.toFixed(1)}

      `;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("🔑 View Wallet", "view_wallet"),
          Markup.button.callback("📊 My Profile", "view_profile"),
        ],
        [
          Markup.button.callback("🏠 Create Group", "create_group"),
          Markup.button.callback("👥 Join Group", "join"),
        ],
        [
          Markup.button.callback("📊 Group Info", "group_info"),
        ],
        [
          Markup.button.callback("Deposit", "deposit_sol"),
          Markup.button.callback("Withdraw", "withdraw_sol"),
        ],
        [
          Markup.button.callback("❓ Help & Commands", "show_help"),
          Markup.button.callback("ℹ️ About Jumpa", "show_about"),
        ],
        [Markup.button.callback("🔄 Refresh", "back_to_menu")] //fix this later
      ]);

      await ctx.reply(welcomeMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Back to menu error:", error);
      await ctx.answerCbQuery("❌ Failed to return to main menu.");
    }
  }
}
