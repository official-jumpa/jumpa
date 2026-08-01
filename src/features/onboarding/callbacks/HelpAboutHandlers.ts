import { Context } from "telegraf";
import { sendOrEdit } from "@shared/utils/messageHelper";
import { getHelpContent, getAboutContent } from "@features/onboarding/utils/helpContent";

// Handle show help callback
export async function handleShowHelp(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery("❓ Help & Commands");

    const { message, options } = getHelpContent(true);

    await sendOrEdit(ctx, message, options);
  } catch (error) {
    console.error("Show help error:", error);
    await ctx.answerCbQuery("❌ Failed to show help.");
  }
}

// Handle show about callback
export async function handleShowAbout(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery("ℹ️ About Jumpa");

    const { message, options } = getAboutContent(true);

    await sendOrEdit(ctx, message, options);
  } catch (error) {
    console.error("Show about error:", error);
    await ctx.answerCbQuery("❌ Failed to show about.");
  }
}
