import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { displayGroupInfo } from "@modules/groups/utils/displayGroupInfo";

export class GroupInfoCommand extends BaseCommand {
  name = "info";
  description = "Show current group information.";

  async execute(ctx: Context): Promise<void> {
    try {
      await displayGroupInfo(ctx);
    } catch (error) {
      console.error("Group info error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to get group info: ${errorMessage}`);
    }
  }
}
