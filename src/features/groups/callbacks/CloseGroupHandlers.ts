import { Context, Markup } from "telegraf";
import { GroupService } from "@features/groups/services/groupService";
import { BlockchainServiceFactory } from "@blockchain/shared/BlockchainServiceFactory";
import { BlockchainDetector } from "@blockchain/shared/utils";
import Group from "@core/database/models/group";
import User from "@core/database/models/user";

export class CloseGroupHandlers {
  /**
   * Handle close group callback
   */
  static async handleCloseGroup(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("🔴 Close Group");

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

      // Check if user is the creator (only creator can close group)
      if (group.creator_id !== userId) {
        await ctx.reply(
          "❌ <b>Permission Denied</b>\n\n" +
          "Only the group creator can close the group.",
          { parse_mode: "HTML" }
        );
        return;
      }

      // Get blockchain service to determine currency
      const blockchainService = BlockchainServiceFactory.detectAndGetService(group.group_address);
      const currency = blockchainService.getNativeCurrency();

      const warningMessage = `
🔴 <b>Close Group - ${group.name}</b>

<b>⚠️ WARNING: This action is irreversible!</b>

Closing the group will:
• Mark the group as <b>ended</b>
• Close the group on the blockchain
• Prevent any further transactions
• Members will need to exit to withdraw their funds

<b>Group Details:</b>
• <b>Name:</b> ${group.name}
• <b>Members:</b>
• <b>Balance:</b> ${0} ${currency}

Are you sure you want to close this group?
      `;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Yes, Close Group", "close_group_confirm"),
          Markup.button.callback("❌ Cancel", "close_group_cancel"),
        ],
      ]);

      await ctx.reply(warningMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } catch (error) {
      console.error("Close group error:", error);
      await ctx.answerCbQuery("❌ Failed to initiate group closure.");
    }
  }

  /**
   * Handle close group confirmation
   */
  static async handleCloseGroupConfirm(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("⏳ Closing group...");

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

      // Verify user is creator
      if (group.creator_id !== userId) {
        await ctx.reply("❌ Only the group creator can close the group.");
        return;
      }

      // Get blockchain service
      const blockchainService = BlockchainServiceFactory.detectAndGetService(group.group_address);
      const currency = blockchainService.getNativeCurrency();
      const chainName = blockchainService.getDisplayName();

      const processingMessage = `
⏳ <b>Closing Group</b>

<b>Group:</b> ${group.name}
<b>Blockchain:</b> ${chainName}
<b>Status:</b> Processing...

<b>Please wait...</b>
      `;

      await ctx.reply(processingMessage, { parse_mode: "HTML" });

      try {
        // Call blockchain-agnostic close group function
        const result = await blockchainService.closeGroup(ctx, group.group_address);

        if (result.success && result.data) {
          // Update group status in database
          await Group.findByIdAndUpdate(group._id, {
            status: "ended"
          });

          const successMessage = `
✅ <b>Group Closed Successfully!</b>

<b>Group:</b> ${group.name}
<b>Blockchain:</b> ${chainName}
<b>Status:</b> Ended
<b>Final Balance:</b> ${0} ${currency}
<b>Transaction Hash:</b> <code>${result.transactionHash || result.data.hash}</code>

The group has been permanently closed on the blockchain.

<b>Next Steps for Members:</b>
• Members should use <code>/exit</code> to withdraw their funds
• No further deposits or transactions are allowed
          `;

          await ctx.reply(successMessage, { parse_mode: "HTML" });
        } else {
          throw new Error(result.error || "Close group transaction failed");
        }

      } catch (blockchainError: any) {
        console.error("Blockchain close group error:", blockchainError);

        let errorMessage = "❌ <b>Failed to Close Group</b>\n\n";

        if (blockchainError.message?.includes("Insufficient")) {
          errorMessage += `<b>Reason:</b> Insufficient ${currency} balance for transaction fees.\n\n`;
          errorMessage += "Please fund your wallet and try again.";
        } else if (blockchainError.message?.includes("User not found")) {
          errorMessage += "<b>Reason:</b> User account not found.\n\n";
          errorMessage += "Please register using /start first.";
        } else if (blockchainError.message?.includes("timeout")) {
          errorMessage += "<b>Reason:</b> Transaction timed out.\n\n";
          errorMessage += "The transaction may still succeed on-chain. Please check the group status in a few moments.";
        } else if (blockchainError.message?.includes("Unauthorized")) {
          errorMessage += "<b>Reason:</b> Only the group owner can close the group.\n\n";
          errorMessage += "Please contact the group creator.";
        } else {
          errorMessage += `<b>Reason:</b> ${blockchainError.message || "Unknown error"}\n\n`;
          errorMessage += "Please try again or contact support if the issue persists.";
        }

        await ctx.reply(errorMessage, { parse_mode: "HTML" });
      }

    } catch (error) {
      console.error("Close group confirm error:", error);
      await ctx.reply("❌ Failed to close group. Please try again.");
    }
  }

  /**
   * Handle close group cancellation
   */
  static async handleCloseGroupCancel(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("❌ Group Closure Cancelled");

      await ctx.reply(
        "❌ Group closure cancelled.\n\nUse <code>/group</code> to return to group management.",
        { parse_mode: "HTML" }
      );
    } catch (error) {
      console.error("Close group cancel error:", error);
      await ctx.answerCbQuery("❌ Failed to cancel.");
    }
  }
}
