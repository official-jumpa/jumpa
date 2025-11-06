import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { getGroupByChatId, isUserMember } from "@modules/ajo-groups/groupService";
import { getMemberFinancialSummary } from "@modules/wallets/balanceService";

export class GroupBalanceCommand extends BaseCommand {
  name = "group_balance";
  description = "Show your balance and share in group";

  async execute(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      const group = await getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply(
          "❌ No group found in this chat.\n\n" +
            "Use `/create_group` to create a new group.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const isMember = await isUserMember(
        group._id.toString(),
        userId
      );
      if (!isMember) {
        await ctx.reply("❌ You are not a member of this group.");
        return;
      }

      const financialSummary = getMemberFinancialSummary(
        group,
        userId
      );

      if (!financialSummary) {
        await ctx.reply("❌ Unable to fetch your financial information.");
        return;
      }

      const balanceMessage = `
💰 **Your Balance: ${group.name}**

**Your Contribution:** $${financialSummary.contribution} SOL
**Your Share:** ${financialSummary.share_percentage.toFixed(2)}%
**Potential Profit Share:** $${financialSummary.potential_profit_share}

**Group Total Balance:** ${group.current_balance} SOL
**Is Trader:** ${financialSummary.is_trader ? "✅ Yes" : "❌ No"}

📊 **Your Stats:**
• Rank: #${financialSummary.rank}
• Status: ${group.status === "active" ? "🟢 Active" : "🔴 Ended"}
      `;

      await ctx.reply(balanceMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("balance error:", error);
      await ctx.reply("❌ Failed to get balance information.");
    }
  }
}

