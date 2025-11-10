import { Context } from "telegraf";
import { displayMainMenu } from "@modules/onboarding/utils/displayMainMenu";

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
}
