import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import {
  createAjo,
  joinAjo,
  getAjoInfo,
  getAjoByChatId,
  getUserAjoGroups,
  isUserMember,
  isUserTrader,
} from "../services/ajoService";
import {
  createPoll,
  voteOnPoll,
  getGroupPolls,
  getPollResults,
  processExpiredPolls,
} from "../services/pollService";
import {
  validateAjoCreation,
  validatePollCreation,
  validateGroupId,
  validateAndSanitizeGroupName,
} from "../validations/ajoValidation";
import {
  updateGroupBalance,
  getGroupFinancialSummary,
  getMemberFinancialSummary,
  trackMemberContribution,
} from "../services/balanceService";
import getUser from "../services/getUserInfo";

export class AjoCommand extends BaseCommand {
  name = "ajo";
  description = "Ajo group management commands";

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
      case "polls":
        await this.handlePolls(ctx);
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
🏠 **Ajo Commands**

**Group Management:**
• \`/ajo create <name> <max_members> [consensus_threshold]\` - Create new Ajo group
• \`/ajo join <group_id>\` - Join existing Ajo group
• \`/ajo info\` - Show current group info
• \`/ajo my_groups\` - Show your Ajo groups

**Group Information:**
• \`/ajo members\` - List group members
• \`/ajo polls\` - Show active polls
• \`/ajo balance\` - Show your balance and share

**Poll Commands:**
• \`/poll_trade <token> <amount>\` - Create trade poll (traders only)
• \`/poll_end\` - Create end ajo poll (traders only)
• \`/vote <poll_id> <yes/no>\` - Vote on poll

**Examples:**
\`/ajo create CryptoCrew 10 67\`
\`/ajo join 507f1f77bcf86cd799439011\`
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
          "❌ Usage: `/ajo create <name> <max_members> [consensus_threshold]`\n\n" +
            "**Example:** `/ajo create CryptoCrew 10 67`",
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
3. Start creating polls with: \`/poll_trade <token> <amount>\`

**You are now a trader and can create polls!**
      `;

      await ctx.reply(successMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Create ajo error:", error);
      await ctx.reply("❌ Failed to create Ajo group. Please try again.");
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
          "❌ Usage: `/ajo join <group_id>`\n\n" +
            "**Example:** `/ajo join 507f1f77bcf86cd799439011`",
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
      `;

      await ctx.reply(successMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Join ajo error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to join Ajo group: ${errorMessage}`);
    }
  }

  private async handleInfo(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get ajo group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply(
          "❌ No Ajo group found in this chat.\n\n" +
            "Use `/ajo create` to create a new group or `/ajo join` to join an existing one.",
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
📊 **Ajo Group: ${ajoGroup.name}**

💰 **Capital:** $${ajoGroup.current_balance} USDC
👥 **Members:** ${ajoGroup.members.length}/${ajoGroup.max_members}
🗳️ **Consensus:** ${ajoGroup.consensus_threshold}%
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
      console.error("Ajo info error:", error);
      await ctx.reply("❌ Failed to get ajo info.");
    }
  }

  private async handleMembers(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get ajo group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No Ajo group found in this chat.");
        return;
      }

      // Get financial summary for member details
      const financialSummary = getGroupFinancialSummary(ajoGroup);

      let membersMessage = `👥 **Ajo Members (${ajoGroup.members.length}/${ajoGroup.max_members})**\n\n`;

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

      membersMessage += `\n**Total Balance:** $${ajoGroup.current_balance} USDC`;

      await ctx.reply(membersMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Ajo members error:", error);
      await ctx.reply("❌ Failed to get ajo members.");
    }
  }

  private async handlePolls(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get ajo group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No Ajo group found in this chat.");
        return;
      }

      // Process expired polls first
      await processExpiredPolls(ajoGroup._id.toString());

      // Get active polls
      const { polls } = await getGroupPolls(ajoGroup._id.toString(), "open");

      let pollsMessage = `🗳️ **Active Polls (${polls.length})**\n\n`;

      if (polls.length === 0) {
        pollsMessage += "No active polls at the moment.\n\n";
        pollsMessage += "**Traders can create polls using:**\n";
        pollsMessage +=
          "• `/poll_trade <token> <amount>` - Create trade poll\n";
        pollsMessage += "• `/poll_end` - Create end ajo poll";
      } else {
        polls.forEach((poll: any, index: any) => {
          const timeLeft = Math.max(
            0,
            Math.floor(
              (new Date(poll.expires_at).getTime() - new Date().getTime()) /
                (1000 * 60 * 60)
            )
          );
          const votes = poll.votes.length;

          pollsMessage += `${index + 1}. **${poll.title}**\n`;
          pollsMessage += `   Type: ${
            poll.type === "trade" ? "🔄 Trade" : "🏁 End Ajo"
          }\n`;
          pollsMessage += `   Votes: ${votes} | Time left: ${timeLeft}h\n`;
          pollsMessage += `   ID: \`${poll.id}\`\n\n`;
        });

        pollsMessage += "**Vote using:** `/vote <poll_id> <yes/no>`";
      }

      await ctx.reply(pollsMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Ajo polls error:", error);
      await ctx.reply("❌ Failed to get ajo polls.");
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

      // Get ajo group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No Ajo group found in this chat.");
        return;
      }

      // Check if user is a member
      const isMember = await isUserMember(ajoGroup._id.toString(), userId);
      if (!isMember) {
        await ctx.reply("❌ You are not a member of this Ajo group.");
        return;
      }

      // Get member's financial summary
      const memberSummary = getMemberFinancialSummary(ajoGroup, userId);
      if (!memberSummary) {
        await ctx.reply("❌ Unable to get your financial information.");
        return;
      }

      const balanceMessage = `
💰 **Your Ajo Balance**

👤 **Your Contribution:** $${memberSummary.contribution}
📊 **Your Share:** ${memberSummary.share_percentage}%
🏆 **Rank:** #${memberSummary.rank}
💎 **Role:** ${memberSummary.is_trader ? "🛠️ Trader" : "👤 Member"}

💰 **Group Balance:** $${ajoGroup.current_balance} USDC
👥 **Total Members:** ${ajoGroup.members.length}

💡 **Potential Profit Share:** $${memberSummary.potential_profit_share}
*(Based on 10% profit assumption)*
      `;

      await ctx.reply(balanceMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Ajo balance error:", error);
      await ctx.reply("❌ Failed to get ajo balance.");
    }
  }

  private async handleMyGroups(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      // Get user's ajo groups
      const userGroups = await getUserAjoGroups(userId);

      let groupsMessage = `🏠 **Your Ajo Groups (${userGroups.length})**\n\n`;

      if (userGroups.length === 0) {
        groupsMessage += "You're not a member of any Ajo groups yet.\n\n";
        groupsMessage += "**To join a group:**\n";
        groupsMessage += "• Get a group ID from an admin\n";
        groupsMessage += "• Use: `/ajo join <group_id>`\n\n";
        groupsMessage += "**To create a group:**\n";
        groupsMessage += "• Use: `/ajo create <name> <max_members>`";
      } else {
        userGroups.forEach((group, index) => {
          const isTrader =
            group.members.find((m: any) => m.user_id === userId)?.role ===
            "trader";
          const role = isTrader ? "🛠️ Trader" : "👤 Member";

          groupsMessage += `${index + 1}. **${group.name}**\n`;
          groupsMessage += `   ${role} | $${group.current_balance} USDC\n`;
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
