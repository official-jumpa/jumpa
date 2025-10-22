import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { getAjoByChatId } from "../services/ajoService";
import { getGroupFinancialSummary } from "../services/balanceService";
import { Markup } from "telegraf";

export class AjoInfoCommand extends BaseCommand {
  name = "group_info";
  description = "Show current group information";

  async execute(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get  group for this chat
      const group = await getAjoByChatId(chatId);
      if (!group) {
        await ctx.reply(
          "❌ No  group found in this chat.\n\n" +
            "Use `/create_group` to create a new group.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Get financial summary
      const financialSummary = getGroupFinancialSummary(group);
      const activePolls = group.polls.filter(
        (poll: any) => poll.status === "open"
      );

      const infoMessage = `
📊 **Group: ${group.name}**

💰 **Capital:** ${group.current_balance} SOL
👥 **Members:** ${group.members.length}/${group.max_members}
🗳️ **Consensus:** ${group.consensus_threshold}%
📈 **Status:** ${group.status === "active" ? "🟢 Active" : "🔴 Ended"}

📊 **Financial Summary:**
• Total Contributions: $${financialSummary.total_contributions}
• Average Contribution: $${financialSummary.average_contribution}
• Largest Contribution: $${financialSummary.largest_contribution}

🗳️ **Active Polls:** ${activePolls.length}
📈 **Total Trades:** ${group.trades.length}

**Group ID:** \`${group._id}\`
**Created:** ${new Date(group.created_at).toLocaleDateString()}
      `;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("👥 View Members", "group_members"),
          Markup.button.callback("🗳️ View Polls", "group_polls"),
        ],
        [
          Markup.button.callback("💰 My Balance", "my_balance"),
          Markup.button.callback("📊 Group Stats", "group_stats"),
        ],
        [Markup.button.callback("🔄 Refresh", "group_info")],
      ]);

      await ctx.reply(infoMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error(" info error:", error);
      await ctx.reply("❌ Failed to get info.");
    }
  }
}




