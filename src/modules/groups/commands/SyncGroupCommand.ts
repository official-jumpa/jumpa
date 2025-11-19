import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { syncGroupFromChain, getGroupByChatId } from "@modules/groups/groupService";
import getUser from "@modules/users/getUserInfo";

export class SyncGroupCommand extends BaseCommand {
  name = "sync_group";
  description = "Sync group data from blockchain";

  async execute(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Check if user is registered
      try {
        await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      // Get the group for this chat
      const group = await getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply(
          "❌ No group found in this chat. Create one first with /create_group"
        );
        return;
      }

      await ctx.reply("🔄 Syncing group data from blockchain...");

      // Sync group from chain
      const syncData = await syncGroupFromChain(group._id.toString());

      // Convert lamports to SOL for display
      const totalContributionsSol = (parseInt(syncData.onChain.totalContributions) / 1_000_000_000).toFixed(4);
      const minimumDepositSol = (parseInt(syncData.onChain.minimumDeposit) / 1_000_000_000).toFixed(4);

      const message = `
✅ **Group Synced Successfully!**

${syncData.syncedRoles > 0 ? `🔄 **Synced ${syncData.syncedRoles} member role(s) from blockchain**\n` : ''}
**Database Info:**
• Name: ${syncData.database.name}
• Members: ${syncData.database.members.length}/${syncData.database.max_members}
• Balance: ${syncData.database.current_balance} SOL

**On-Chain Info:**
• Owner: \`${syncData.onChain.owner.substring(0, 8)}...${syncData.onChain.owner.substring(syncData.onChain.owner.length - 8)}\`
• State: ${syncData.onChain.state}
• Traders: ${syncData.onChain.traders.length}
• Members: ${syncData.onChain.members.length}
• Total Contributions: ${totalContributionsSol} SOL
• Minimum Deposit: ${minimumDepositSol} SOL
• Group Type: ${syncData.onChain.isPrivate ? "Private (requires approval)" : "Public (auto-approved)"}
• Locked: ${syncData.onChain.locked ? "Yes" : "No"}
• Exit Penalty: ${syncData.onChain.exitPenaltyPercentage}%
• Lock Period: ${syncData.onChain.lockPeriodDays} days
• Created: ${syncData.onChain.createdAt.toLocaleDateString()}

**On-Chain Address:** \`${group.onchain_group_address}\`
      `;

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Sync group error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to sync group: ${errorMessage}`);
    }
  }
}


