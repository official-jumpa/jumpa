import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { createGroup } from "@modules/ajo-groups/groupService";
import {
  validateAjoCreation,
  validateAndSanitizeGroupName,
} from "@modules/ajo-groups/ajoValidation";
import getUser from "@modules/users/getUserInfo";

export class CreateGroupCommand extends BaseCommand {
  name = "create_group";
  description = "Create a new group with custom parameters";

  async execute(ctx: Context): Promise<void> {
    try {
      const args =
        ctx.message && "text" in ctx.message
          ? ctx.message.text.split(" ").slice(1)
          : [];
      console.log("CreateGroupCommand args:", args);
      console.log("CreateGroupCommand args length:", args.length);
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }
      if (!args || args.length === 0) {
        await ctx.reply(`❌ No arguments provided. Please provide group details.

<b>Usage:</b> /create_group [name] [max_members] [type]

<b>Example:</b> /create_group CryptoCrew 20 public`, { parse_mode: "HTML" });
        return;
      }

      if (args.length < 2) {
        await ctx.reply(
          "❌ Usage: `/create_group <name> <max_members> [type]`\n\n" +
          "**Examples:**\n" +
          "• `/create_group CryptoCrew 10 public` - Anyone can join\n" +
          "• `/create_group MoonTraders 25 private` - Requires approval\n" +
          "• `/create_group DeFiSquad 50` - Defaults to public\n\n" +
          "**Parameters:**\n" +
          "• **name**: Group name (max 100 characters)\n" +
          "• **max_members**: Maximum members (2-100)\n" +
          "• **type**: `public` or `private` (optional, defaults to public)\n\n" +
          "**Group Types:**\n" +
          "• **Public**: Members are auto-approved when they join\n" +
          "• **Private**: Members need approval from owner/trader after joining",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Parse arguments
      const name = args[0];
      const maxMembers = parseInt(args[1]);
      const groupType = args[2]?.toLowerCase() || "public";
      const isPrivate = groupType === "private";
      // Validate and sanitize input
      const nameValidation = validateAndSanitizeGroupName(name);
      if (!nameValidation.isValid) {
        await ctx.reply(`❌ ${nameValidation.errors.join(", ")}`);
        return;
      }

      // Validate group type
      if (groupType !== "public" && groupType !== "private") {
        await ctx.reply(`❌ Invalid group type. Use 'public' or 'private'.`);
        return;
      }

      const validation = validateAjoCreation({
        name: nameValidation.sanitized,
        max_members: maxMembers,
      });

      if (!validation.isValid) {
        await ctx.reply(`❌ ${validation.errors.join(", ")}`);
        return;
      }

      // Auto-register user if not exists (creates wallet automatically)
      let user;
      try {
        user = await getUser(userId, username);

        // If this is a new user, send welcome message
        if (user && !user.last_seen) {
          await ctx.reply(
            `👋 Welcome! I've created a wallet for you.\n\n` +
            `🔑 **Wallet:** \`${user.wallet_address}\`\n\n` +
            `⚠️ **Important:** You'll need SOL to create groups. Use \`/fund_wallet\` for instructions.`,
            { parse_mode: "Markdown" }
          );
        }
      } catch (error) {
        await ctx.reply("❌ Failed to create wallet. Please try /start first.");
        return;
      }

      // Send initial message to user
      const processingMessage = await ctx.reply(
        "🔄 **Creating group on blockchain...**\n\n" +
        "⏳ This may take up to 2 minutes. Please wait...",
        { parse_mode: "Markdown" }
      );

      try {
        // Create the group
        const group = await createGroup({
          name: nameValidation.sanitized,
          creator_id: userId,
          telegram_chat_id: chatId,
          is_private: isPrivate,
          max_members: maxMembers,
        });

        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        const successMessage = `
✅ **Group Created Successfully!**

🏠 **Name:** ${group.name}
👥 **Max Members:** ${group.max_members}
🔒 **Type:** ${isPrivate ? 'Private (requires approval)' : 'Public (auto-approved)'}
📊 **Status:** Active

**Group ID:** \`${group._id}\`

**Next Steps:**
1. Share the Group ID with people you want to invite
2. They can join using: \`/join ${group._id}\`
${isPrivate ? '3. Approve new members using: `/approve_member`\n4. Start trading' : '3. Start trading'}

**Quick Actions:**
• Use \`/info\` to view group details
• Use \`/members\` to see members
• Use \`/set_minimum_deposit\` to set minimum deposit amount
      `;

        await ctx.reply(successMessage, { parse_mode: "Markdown" });
      } catch (createError) {
        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        console.error("Create group error:", createError);
        const errorMessage =
          createError instanceof Error ? createError.message : "Unknown error";
        await ctx.reply(`❌ Failed to create group: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Create group error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to create group: ${errorMessage}`);
    }
  }
}

