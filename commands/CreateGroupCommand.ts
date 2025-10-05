import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { createAjo } from "../services/ajoService";
import {
  validateAjoCreation,
  validateAndSanitizeGroupName,
} from "../validations/ajoValidation";
import getUser from "../services/getUserInfo";

export class CreateGroupCommand extends BaseCommand {
  name = "create_group";
  description = "Create a new Ajo group with custom parameters";

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

      if (args.length < 2) {
        await ctx.reply(
          "❌ Usage: `/create_group <name> <max_members> [consensus_threshold]`\n\n" +
            "**Examples:**\n" +
            "• `/create_group CryptoCrew 10 67`\n" +
            "• `/create_group MoonTraders 25`\n" +
            "• `/create_group DeFi Squad 50 75`\n\n" +
            "**Parameters:**\n" +
            "• **name**: Group name (max 100 characters)\n" +
            "• **max_members**: Maximum members (2-100)\n" +
            "• **consensus_threshold**: Voting threshold % (50-100, default: 67)",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Parse arguments
      const name = args[0];
      const maxMembers = parseInt(args[1]);
      const consensusThreshold = args[2] ? parseInt(args[2]) : 67;

      // Validate and sanitize input
      const nameValidation = validateAndSanitizeGroupName(name);
      if (!nameValidation.isValid) {
        await ctx.reply(`❌ ${nameValidation.errors.join(", ")}`);
        return;
      }

      const validation = validateAjoCreation({
        name: nameValidation.sanitized,
        initial_capital: 0, // Will be updated when members contribute
        max_members: maxMembers,
        consensus_threshold: consensusThreshold,
      });

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

      // Check if this chat already has an ajo group
      const { getAjoByChatId } = await import("../services/ajoService");
      const existingGroup = await getAjoByChatId(chatId);
      if (existingGroup) {
        await ctx.reply(
          `❌ This chat already has an Ajo group: **${existingGroup.name}**\n\n` +
            `Use \`/ajo info\` to view group details.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Create the ajo group
      const ajoGroup = await createAjo({
        name: nameValidation.sanitized,
        creator_id: userId,
        telegram_chat_id: chatId,
        initial_capital: 0,
        max_members: maxMembers,
        consensus_threshold: consensusThreshold,
      });

      const successMessage = `
✅ **Ajo Group Created Successfully!**

🏠 **Name:** ${ajoGroup.name}
👥 **Max Members:** ${ajoGroup.max_members}
🗳️ **Consensus:** ${ajoGroup.consensus_threshold}%
📊 **Status:** Active

**Group ID:** \`${ajoGroup._id}\`

**Next Steps:**
1. Share the Group ID with people you want to invite
2. They can join using: \`/ajo join ${ajoGroup._id}\`
3. Start creating polls with: \`/poll trade <token> <amount>\`

**You are now a trader and can create polls!**

**Quick Actions:**
• Use \`/ajo info\` to view group details
• Use \`/ajo members\` to see members
• Use \`/add_members\` to manage members
      `;

      await ctx.reply(successMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Create group error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to create Ajo group: ${errorMessage}`);
    }
  }
}

