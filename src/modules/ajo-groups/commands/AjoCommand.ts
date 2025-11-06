import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import {
  createGroup,
  joinGroup,
  getGroupInfo,
  getGroupByChatId,
  getUserGroups,
  isUserMember,
  isUserTrader,
} from "@modules/ajo-groups/groupService";

import {
  validateAjoCreation,
  validateGroupId,
  validateAndSanitizeGroupName,
} from "@modules/ajo-groups/ajoValidation";
import {
  updateGroupBalance,
  getGroupFinancialSummary,
  getMemberFinancialSummary,
  trackMemberContribution,
} from "@modules/wallets/balanceService";
import getUser from "@modules/users/getUserInfo";

export class AjoCommand extends BaseCommand {
  name = "group";
  description = " group management commands";

  async execute(ctx: Context): Promise<void> {
    const args =
      ctx.message && "text" in ctx.message
        ? ctx.message.text.split(" ").slice(1)
        : [];

    if (args.length === 0) {
      await this.showHelp(ctx);
      return;
    }

    const subCommand = args[0].toLowerCase();

    switch (subCommand) {
      case "create":
        await this.handleCreate(ctx, args.slice(1));
        break;
      case "join":
        await this.handleJoin(ctx, args.slice(1));
        break;
      case "info":
        await this.handleInfo(ctx);
        break;
      case "members":
        await this.handleMembers(ctx);
        break;
      case "balance":
        await this.handleBalance(ctx);
        break;
      case "my_groups":
        await this.handleMyGroups(ctx);
        break;
      default:
        await this.showHelp(ctx);
    }
  }

  private async showHelp(ctx: Context): Promise<void> {
    const helpMessage = `
🏠 **Commands**

**Group Management:**
• \`/create <name> <max_members> [type]\` - Create new group
• \`/join <group_id>\` - Join existing group
• \`/info\` - Show current group info
• \`/my_groups\` - Show your groups

**Group Information:**
• \`/members\` - List group members
• \`/polls\` - Show active polls
• \`/balance\` - Show your balance and share

**Poll Commands:**
• \`/poll_trade <token> <amount>\` - Create trade poll (traders only)
• \`/poll_end\` - Create end poll (traders only)
• \`/vote <poll_id> <yes/no>\` - Vote on poll

**Examples:**
\`/create CryptoCrew 10 public\` - Public group
\`/create MoonTraders 20 private\` - Private group (requires approval)
\`/join 507f1f77bcf86cd799439011\`
\`/poll_trade BONK 1000\`
\`/vote 507f1f77bcf86cd799439012 yes\`
    `;

    await ctx.reply(helpMessage, { parse_mode: "Markdown" });
  }

  private async handleCreate(ctx: Context, args: string[]): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      if (args.length < 2) {
        await ctx.reply(
          "❌ Usage: `/create <name> <max_members> [type]`\n\n" +
            "**Examples:**\n" +
            "• `/create CryptoCrew 10 public` - Public group\n" +
            "• `/create MoonTraders 20 private` - Private group",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Parse arguments
      const name = args[0];
      const maxMembers = parseInt(args[1]);
      const groupType = args[2]?.toLowerCase() || "public";
      const isPrivate = groupType === "private";

      // Validate group type
      if (groupType !== "public" && groupType !== "private") {
        await ctx.reply(`❌ Invalid group type. Use 'public' or 'private'.`);
        return;
      }

      // Validate and sanitize input
      const nameValidation = validateAndSanitizeGroupName(name);
      if (!nameValidation.isValid) {
        await ctx.reply(`❌ ${nameValidation.errors.join(", ")}`);
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

      // Check if user is registered
      try {
        await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      // Create the group
      const ajoGroup = await createGroup({
        name: nameValidation.sanitized,
        creator_id: userId,
        telegram_chat_id: chatId,
        is_private: isPrivate,
        max_members: maxMembers
      });

      const successMessage = `
✅ **Group Created Successfully!**

🏠 **Name:** ${ajoGroup.name}
👥 **Max Members:** ${ajoGroup.max_members}
🔒 **Type:** ${isPrivate ? 'Private (requires approval)' : 'Public (auto-approved)'}
📊 **Status:** Active

**Group ID:** \`${ajoGroup._id}\`

**Next Steps:**
1. Share the Group ID with people you want to invite
2. They can join using: \`/join ${ajoGroup._id}\`
${isPrivate ? '3. Approve new members using: `/approve_member`\n4. Start creating polls with: `/poll_trade <token> <amount>`' : '3. Start creating polls with: `/poll_trade <token> <amount>`'}

**You are now a trader and can create polls!**
      `;

      await ctx.reply(successMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Create group error:", error);
      await ctx.reply("❌ Failed to create group. Please try again.");
    }
  }

  private async handleJoin(ctx: Context, args: string[]): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      if (args.length < 1) {
        await ctx.reply(
          "❌ Usage: `/join <group_id>`\n\n" +
            "**Example:** `/join 507f1f77bcf86cd799439011`",
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

      // Auto-register user if not exists (creates wallet automatically)
      let user;
      try {
        user = await getUser(userId, username);
        
        // If this is a new user, send welcome message
        if (user && !user.last_seen) {
          await ctx.reply(
            `👋 Welcome! I've created a wallet for you.\n\n` +
            `🔑 **Wallet:** \`${user.wallet_address}\`\n\n` +
            `⚠️ **Important:** You'll need SOL to join groups. Use \`/fund_wallet\` for instructions.`,
            { parse_mode: "Markdown" }
          );
        }
      } catch (error) {
        await ctx.reply("❌ Failed to create wallet. Please try /start first.");
        return;
      }

      // Send initial message to user
      const processingMessage = await ctx.reply(
        "🔄 **Joining group on blockchain...**\n\n" +
        "⏳ This may take up to 2 minutes. Please wait...",
        { parse_mode: "Markdown" }
      );

      try {
        // Join the group
        const ajoGroup = await joinGroup({
          group_id: groupId,
          user_id: userId,
          contribution: 0, // Will be updated when they contribute
        });

        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

      const successMessage = `
✅ **Successfully Joined Group!**

🏠 **Group:** ${ajoGroup.name}
👥 **Members:** ${ajoGroup.members.length}/${ajoGroup.max_members}

**Next Steps:**
1. Contribute funds to the group
2. Vote on trading decisions
3. Share in the profits!

**Useful Commands:**
• \`/info\` - View group details
• \`/polls\` - See active polls
• \`/balance\` - Check your share
      `;

        await ctx.reply(successMessage, { parse_mode: "Markdown" });
      } catch (joinError) {
        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        console.error("Join error:", joinError);
        let errorMessage = joinError instanceof Error ? joinError.message : "Unknown error";
        
        // Provide helpful message for RPC errors
        if (errorMessage.includes('fetch failed') || errorMessage.includes('failed to get info about account')) {
          errorMessage = "Network connection issue. The RPC endpoint is temporarily unavailable. Please try again in a few moments.";
        }
        
        await ctx.reply(`❌ Failed to join group: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Join error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to join group: ${errorMessage}`);
    }
  }

  private async handleInfo(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get group for this chat
      const ajoGroup = await getGroupByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply(
          "❌ No group found in this chat.\n\n" +
            "Use `/create` to create a new group or `/join` to join an existing one.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Get financial summary
      const financialSummary = getGroupFinancialSummary(ajoGroup);
      const activePolls = ajoGroup.polls.filter(
        (poll: any) => poll.status === "open"
      );

      const infoMessage = `
📊 *Group: ${ajoGroup.name}**

💰 **Capital:** ${ajoGroup.current_balance} SOL
👥 **Members:** ${ajoGroup.members.length}/${ajoGroup.max_members}
📈 **Status:** ${ajoGroup.status === "active" ? "🟢 Active" : "🔴 Ended"}

📊 **Financial Summary:**
• Total Contributions: $${financialSummary.total_contributions}
• Average Contribution: $${financialSummary.average_contribution}
• Largest Contribution: $${financialSummary.largest_contribution}

🗳️ **Active Polls:** ${activePolls.length}
📈 **Total Trades:** ${ajoGroup.trades.length}

**Group ID:** \`${ajoGroup._id}\`
**Created:** ${new Date(ajoGroup.created_at).toLocaleDateString()}
      `;

      await ctx.reply(infoMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("info error:", error);
      await ctx.reply("❌ Failed to get info.");
    }
  }

  private async handleMembers(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get group for this chat
      const ajoGroup = await getGroupByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Get financial summary for member details
      const financialSummary = getGroupFinancialSummary(ajoGroup);

      let membersMessage = `👥 **Members (${ajoGroup.members.length}/${ajoGroup.max_members})**\n\n`;

      // Sort members by contribution (highest first)
      const sortedMembers = [...ajoGroup.members].sort(
        (a: any, b: any) => b.contribution - a.contribution
      );

      sortedMembers.forEach((member: any, index: any) => {
        const shareInfo = financialSummary.profit_shares.find(
          (share: any) => share.user_id === member.user_id
        );
        const sharePercentage = shareInfo ? shareInfo.share_percentage : 0;
        const role = member.role === "trader" ? "🛠️ Trader" : "👤 Member";

        membersMessage += `${index + 1}. ${role} - $${
          member.contribution
        } (${sharePercentage}%)\n`;
      });

      membersMessage += `\n**Total Balance:** ${ajoGroup.current_balance} SOL`;

      await ctx.reply(membersMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("members error:", error);
      await ctx.reply("❌ Failed to get members.");
    }
  }

  private async handleBalance(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Get  group for this chat
      const ajoGroup = await getGroupByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No  group found in this chat.");
        return;
      }

      // Check if user is a member
      const isMember = await isUserMember(ajoGroup._id.toString(), userId);
      if (!isMember) {
        await ctx.reply("❌ You are not a member of this  group.");
        return;
      }

      // Get member's financial summary
      const memberSummary = getMemberFinancialSummary(ajoGroup, userId);
      if (!memberSummary) {
        await ctx.reply("❌ Unable to get your financial information.");
        return;
      }

      const balanceMessage = `
💰 **Your  Balance**

👤 **Your Contribution:** $${memberSummary.contribution}
📊 **Your Share:** ${memberSummary.share_percentage}%
🏆 **Rank:** #${memberSummary.rank}
💎 **Role:** ${memberSummary.is_trader ? "🛠️ Trader" : "👤 Member"}

💰 **Group Balance:** ${ajoGroup.current_balance} SOL
👥 **Total Members:** ${ajoGroup.members.length}

💡 **Potential Profit Share:** $${memberSummary.potential_profit_share}
*(Based on 10% profit assumption)*
      `;

      await ctx.reply(balanceMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error(" balance error:", error);
      await ctx.reply("❌ Failed to get balance.");
    }
  }

  private async handleMyGroups(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      // Get user's  groups
      const userGroups = await getUserGroups(userId);

      let groupsMessage = `🏠 **Your Groups (${userGroups.length})**\n\n`;

      if (userGroups.length === 0) {
        groupsMessage += "You're not a member of any  groups yet.\n\n";
        groupsMessage += "**To join a group:**\n";
        groupsMessage += "• Get a group ID from an admin\n";
        groupsMessage += "• Use: `/join <group_id>`\n\n";
        groupsMessage += "**To create a group:**\n";
        groupsMessage += "• Use: `/create <name> <max_members>`";
      } else {
        userGroups.forEach((group, index) => {
          const isTrader =
            group.members.find((m: any) => m.user_id === userId)?.role ===
            "trader";
          const role = isTrader ? "🛠️ Trader" : "👤 Member";

          groupsMessage += `${index + 1}. **${group.name}**\n`;
          groupsMessage += `   ${role} | ${group.current_balance} SOL\n`;
          groupsMessage += `   ${group.members.length}/${group.max_members} members\n`;
          groupsMessage += `   ID: \`${group._id}\`\n\n`;
        });
      }

      await ctx.reply(groupsMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("My groups error:", error);
      await ctx.reply("❌ Failed to get your groups.");
    }
  }
}
