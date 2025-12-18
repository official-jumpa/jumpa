import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import Group from "@database/models/group";
import getUser from "@modules/users/getUserInfo";
import { BlockchainServiceFactory } from "@blockchain/core/BlockchainServiceFactory";

export class LeaveGroupCommand extends BaseCommand {
  name = "leave_group";
  description = "Leave a group";

  async execute(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Get user
      let user;
      try {
        user = await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      // Get group
      const group = await Group.findOne({ telegram_chat_id: chatId });
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Check if group has a group_address
      if (!group.group_address) {
        await ctx.reply(
          "❌ This group doesn't have a blockchain address. Please create a new group."
        );
        return;
      }

      // Check if user is a member
      const memberIndex = group.members.findIndex((m: any) => m.user_id === userId);
      if (memberIndex === -1) {
        await ctx.reply("❌ You are not a member of this group.");
        return;
      }

      // Check if user is the owner
      if (group.creator_id === userId) {
        await ctx.reply(
          `❌ Group owners cannot leave their own group.

You can close the group instead using the appropriate command.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Get blockchain service based on group address
      const blockchainService = BlockchainServiceFactory.detectAndGetService(group.group_address);
      const chainName = blockchainService.getDisplayName();
      const currency = blockchainService.getNativeCurrency();

      // Send loading message
      const loadingMsg = await ctx.reply(
        `⏳ Leaving group on ${chainName}... This might take up to a minute`
      );
      const loadingMsgId = loadingMsg.message_id;

      try {
        // Leave group using blockchain-agnostic service
        const leaveResult = await blockchainService.leaveGroup(ctx, group.group_address);
        console.log("leaveResult", leaveResult);

        if (leaveResult.success && leaveResult.data) {
          // Remove member from database
          group.members.splice(memberIndex, 1);
          await group.save();

          // Fetch group info to get updated balances
          const groupInfo = await blockchainService.fetchGroupInfo(group.group_address);
          const contribution = groupInfo.success && groupInfo.data
            ? groupInfo.data.minimumDeposit
            : 0;

          const successMessage = `
<b>✅ Successfully Left Group!</b>

<b>Group Name:</b> ${group.name}
<b>Blockchain:</b> ${chainName}

<b>Group Address:</b> <code>${group.group_address}</code>

<b>💰 Financial Summary:</b>
• <b>Your Contribution:</b> ${contribution.toFixed(4)} ${currency}

<b>👥 Remaining Members:</b> ${group.members.length}

<b>Transaction Hash:</b> <code>${leaveResult.transactionHash || leaveResult.data.hash || "N/A"}</code>

Your funds have been returned to your wallet. You can rejoin anytime! 👋
          `;

          // Replace loading message with success message
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            loadingMsgId,
            undefined,
            successMessage,
            { parse_mode: "HTML" }
          );
        } else {
          const errorMessage = `
<b>❌ Failed to leave group on ${chainName}</b>

<b>Group:</b> ${group.name}
<b>Group Address:</b> <code>${group.group_address}</code>

<b>Reason:</b> ${leaveResult.error || "Unknown error occurred"}

Please try again later or contact support.
          `;

          // Replace loading message with error message
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            loadingMsgId,
            undefined,
            errorMessage,
            { parse_mode: "HTML" }
          );
        }
      } catch (error) {
        console.error(`Error leaving ${chainName} group:`, error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        try {
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            loadingMsgId,
            undefined,
            `<b>❌ An error occurred while leaving the group</b>

<b>Error:</b> ${errorMessage}

Please try again later.`,
            { parse_mode: "HTML" }
          );
        } catch (editError) {
          await ctx.reply(
            `❌ An error occurred while leaving the group: ${errorMessage}`
          );
        }
      }
    } catch (error) {
      console.error("Leave group error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to leave group: ${errorMessage}`);
    }
  }
}
