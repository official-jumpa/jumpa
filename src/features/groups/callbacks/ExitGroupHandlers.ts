import { Context, Markup } from "telegraf";
import { GroupService } from "@features/groups/services/groupService";
import { BlockchainServiceFactory } from "@blockchain/shared/BlockchainServiceFactory";
import { BlockchainDetector } from "@blockchain/shared/utils";
import Group from "@core/database/models/group";
import User from "@core/database/models/user";

export class ExitGroupHandlers {
  /**
   * Handle exit group callback
   */
  static async handleExitGroup(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("🚪 Exit Group");

      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Get group for this chat
      const group = await GroupService.getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Check if user is a member
      const isMember = await GroupService.isUserMember(group._id.toString(), userId);
      if (!isMember) {
        await ctx.reply("❌ You are not a member of this group.");
        return;
      }

      // Get blockchain service to determine currency
      const blockchainService = BlockchainServiceFactory.detectAndGetService(group.group_address);
      const currency = blockchainService.getNativeCurrency();

      // Get member's contribution
      const member = group.members.find((m: any) => m.user_id === userId);
      const memberContribution = 0;

      const warningMessage = `
🚪 <b>Exit Group - ${group.name}</b>

<b>⚠️ WARNING: This action will remove you from the group!</b>

Exiting the group will:
• Withdraw all your contribution and accumulated profit, if any, from the group
• Remove you from the member list
• You may incur an exit penalty based on group settings
• You cannot rejoin without an invitation

<b>Your Details:</b>
• <b>Your Contribution:</b> ${memberContribution.toFixed(4)} ${currency}
• <b>Role:</b>

<b>Note:</b> Exit penalties may apply. Check group settings for details.

Are you sure you want to exit this group?
      `;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Yes, Exit Group", "exit_group_confirm"),
          Markup.button.callback("❌ Cancel", "exit_group_cancel"),
        ],
      ]);

      await ctx.reply(warningMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } catch (error) {
      console.error("Exit group error:", error);
      await ctx.answerCbQuery("❌ Failed to initiate group exit.");
    }
  }

  /**
   * Handle exit group confirmation
   */
  static async handleExitGroupConfirm(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("⏳ Exiting group...");

      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Get group
      const group = await GroupService.getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Verify user is a member
      const isMember = await GroupService.isUserMember(group._id.toString(), userId);
      if (!isMember) {
        await ctx.reply("❌ You are not a member of this group.");
        return;
      }

      // Get blockchain service
      const blockchainService = BlockchainServiceFactory.detectAndGetService(group.group_address);
      const currency = blockchainService.getNativeCurrency();
      const chainName = blockchainService.getDisplayName();

      const processingMessage = `
⏳ <b>Exiting Group</b>

<b>Group:</b> ${group.name}
<b>Blockchain:</b> ${chainName}

<b>Status:</b> Processing...
<b>Please wait...</b>
      `;

      await ctx.reply(processingMessage, { parse_mode: "HTML" });

      try {
        // Call blockchain-agnostic leave group function
        const result = await blockchainService.leaveGroup(ctx, group.group_address);

        if (result.success && result.data) {
          // Fetch updated group info from blockchain
          const groupInfo = await blockchainService.fetchGroupInfo(group.group_address);
          const actualBalance = groupInfo.success && groupInfo.data
            ? groupInfo.data.totalContributions
            : 0;

          // Remove member from database
          const updatedMembers = group.members.filter((m: any) => m.user_id !== userId);
          await Group.findByIdAndUpdate(group._id, {
            members: updatedMembers,
            current_balance: actualBalance,
          });

          const successMessage = `
✅ <b>Successfully Exited Group!</b>

<b>Group:</b> ${group.name}
<b>Blockchain:</b> ${chainName}
<b>Status:</b> You have been removed from the group
<b>Transaction Hash:</b> <code>${result.transactionHash || result.data.hash}</code>

Your contribution has been withdrawn and sent back to your wallet.

Use <code>/wallet</code> to check your updated balance.
          `;

          await ctx.reply(successMessage, { parse_mode: "HTML" });
        } else {
          throw new Error(result.error || "Leave group transaction failed");
        }

      } catch (blockchainError: any) {
        console.error("Blockchain exit group error:", blockchainError);

        let errorMessage = "❌ <b>Failed to Exit Group</b>\n\n";

        // Check for lock period error (Solana Anchor error code)
        if (blockchainError.error?.errorCode?.number === 6013) {
          errorMessage += "<b>Reason:</b> Lock period is still active\n\n";
          errorMessage += "You must wait for the required lock period after joining before you can exit the group.\n\n";
        } else if (blockchainError.message?.includes("Insufficient")) {
          errorMessage += `<b>Reason:</b> Insufficient ${currency} balance for transaction fees.\n\n`;
          errorMessage += "Please fund your wallet and try again.";
        } else if (blockchainError.message?.includes("User not found")) {
          errorMessage += "<b>Reason:</b> User account not found.\n\n";
          errorMessage += "Please register using /start first.";
        } else if (blockchainError.message?.includes("timeout")) {
          errorMessage += "<b>Reason:</b> Transaction timed out.\n\n";
          errorMessage += "The transaction may still succeed on-chain. Please check the group status in a few moments.";
        } else if (blockchainError.message?.includes("Not a member")) {
          errorMessage += "<b>Reason:</b> You are not a member of this group.\n\n";
          errorMessage += "Only group members can exit.";
        } else {
          errorMessage += `<b>Reason:</b> ${blockchainError.error?.errorMessage || blockchainError.message || "Unknown error"}\n\n`;
          errorMessage += "Please try again or contact support if the issue persists.";
        }

        await ctx.reply(errorMessage, { parse_mode: "HTML" });
      }

    } catch (error) {
      console.error("Exit group confirm error:", error);
      await ctx.reply("❌ Failed to exit group. Please try again.");
    }
  }

  /**
   * Handle exit group cancellation
   */
  static async handleExitGroupCancel(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("❌ Exit Cancelled");

      await ctx.reply(
        "❌ Group exit cancelled.\n\nUse <code>/group</code> to return to group management.",
        { parse_mode: "HTML" }
      );
    } catch (error) {
      console.error("Exit group cancel error:", error);
      await ctx.answerCbQuery("❌ Failed to cancel.");
    }
  }
}
