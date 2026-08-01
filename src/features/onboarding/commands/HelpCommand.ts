import { Context } from "telegraf";
import { getHelpContent } from "@features/onboarding/utils/helpContent";

export const helpCommandConfig = {
  name: "help",
  description: "Show help message with available commands",
};

export async function handleHelpCommand(ctx: Context): Promise<void> {
  const { message, options } = getHelpContent(false);
  await ctx.reply(message, options);
}
