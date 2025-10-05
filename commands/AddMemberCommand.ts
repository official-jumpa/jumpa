import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { getAjoByChatId, isUserTrader, joinAjo } from "../services/ajoService";
import { validateGroupId } from "../validations/ajoValidation";
import getUser from "../services/getUserInfo";

export class AddMemberCommand extends BaseCommand {
  name = "add_member";
  description = "Add a member to an Ajo group";

  async execute(ctx: Context): Promise<void> {
    try {
      const args =
        ctx.message && "text" in ctx.message
          ? ctx.message.text.split(" ").slice(1)
          : [];

      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      if (args.length < 1) {
        await ctx.reply(
          "❌ Usage: `/add_member <group_id>`\n\n" +
            "**Example:** `/add_member 507f1f77bcf86cd799439011`\n\n" +
            "**Note:** This command is for joining groups. Use the Group ID provided by the group creator.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const groupId = args[0];

      // Validate group ID
      const validation = validateGroupId(groupId);
      if (!validation.isValid) {
        await ctx.reply(`❌ ${validation.errors.join(", ")}`);
        return;
      }

      // Check if user is registered
      try {
        await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      // Join the ajo group
      const ajoGroup = await joinAjo({
        group_id: groupId,
        user_id: userId,
        contribution: 0, // Will be updated when they contribute
      });

      const successMessage = `
✅ **Successfully Joined Ajo Group!**

🏠 **Group:** ${ajoGroup.name}
👥 **Members:** ${ajoGroup.members.length}/${ajoGroup.max_members}
🗳️ **Consensus:** ${ajoGroup.consensus_threshold}%

**Next Steps:**
1. Contribute funds to the group
2. Vote on trading decisions
3. Share in the profits!

**Useful Commands:**
• \`/ajo info\` - View group details
• \`/ajo polls\` - See active polls
• \`/ajo balance\` - Check your share
• \`/ajo members\` - See all members
      `;

      await ctx.reply(successMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Add member error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to join Ajo group: ${errorMessage}`);
    }
  }
}
