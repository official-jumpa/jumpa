import { Context } from "telegraf";
import { displayMainMenu } from "@features/onboarding/utils/displayMainMenu";

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

      // Use the shared displayMainMenu function
      await displayMainMenu(ctx, telegramId, username);
    } catch (error) {
      console.error("Back to menu error:", error);
      await ctx.answerCbQuery("❌ Failed to return to main menu.");
    }
  }

  // Handle refresh balances callback - force refresh from blockchain
  static async handleRefreshBalances(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("🔄 Refreshing balances...");

      // Display main menu with force refresh enabled
      await displayMainMenu(ctx, telegramId, username, true);
    } catch (error) {
      console.error("Refresh balances error:", error);
      await ctx.answerCbQuery("❌ Failed to refresh balances.");
    }
  }
}
