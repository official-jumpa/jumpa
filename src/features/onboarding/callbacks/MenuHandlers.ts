import { Context } from "telegraf";
import { displayMainMenu } from "@features/onboarding/utils/displayMainMenu";

// Handle back to main menu callback
export async function handleBackToMenu(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

    if (!telegramId) {
      await ctx.answerCbQuery("❌ Unable to identify your account.");
      return;
    }

    await ctx.answerCbQuery("🏠 Back to Main Menu");

    await displayMainMenu(ctx, telegramId, username);
  } catch (error) {
    console.error("Back to menu error:", error);
    await ctx.answerCbQuery("❌ Failed to return to main menu.");
  }
}

// Handle refresh balances callback
export async function handleRefreshBalances(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

    if (!telegramId) {
      await ctx.answerCbQuery("❌ Unable to identify your account.");
      return;
    }

    await ctx.answerCbQuery("🔄 Refreshing balances...");

    await displayMainMenu(ctx, telegramId, username, true);
  } catch (error) {
    console.error("Refresh balances error:", error);
    await ctx.answerCbQuery("❌ Failed to refresh balances.");
  }
}
