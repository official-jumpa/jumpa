import { Context } from "telegraf";
import { BaseCommand } from "@telegram/commands/BaseCommand";
import Group from "@core/database/models/group";
import getUser from "@features/users/getUserInfo";
import { BlockchainServiceFactory } from "@blockchain/shared/BlockchainServiceFactory";

export class JoinGroupCommand extends BaseCommand {
  name = "join";
  description = "Join an existing group with a group address";

  async execute(ctx: Context): Promise<void> {
    try {
      const args =
        ctx.message && "text" in ctx.message
          ? ctx.message.text.split(" ").slice(1)
          : [];

      const userId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      if (args.length !== 1) {
        await ctx.reply(
          `<b>❌ Invalid command format</b>

<b>Usage:</b> <code>/join groupAddress</code>

<b>Examples:</b>
<code>/join 0x1234567890abcdef1234567890abcdef12345678</code>

<b>Parameter:</b>
• <b>groupAddress:</b> The blockchain address of the group you want to join`,
          { parse_mode: "HTML" }
        );
        return;
      }

      const groupAddress = args[0];

      // Check if user is registered
      let user;
      try {
        user = await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      // Find the group by address
      const group = await Group.findOne({ group_address: groupAddress });
      if (!group) {
        await ctx.reply(
          `<b>❌ No group found with address:</b> <code>${groupAddress}</code>

Please check the address and try again.`,
          { parse_mode: "HTML" }
        );
        return;
      }

      // Check if user is already a member
      const isMember = group.members.some((m: any) => m.user_id === userId);
      if (isMember) {
        await ctx.reply(
          `❌ You are already a member of <b>${group.name}</b>`,
          { parse_mode: "HTML" }
        );
        return;
      }

      // Get blockchain service based on group address
      const blockchainService = BlockchainServiceFactory.detectAndGetService(groupAddress);
      const chainName = blockchainService.getDisplayName();
      const currency = blockchainService.getNativeCurrency();

      // Send loading message
      const loadingMsg = await ctx.reply(
        `⏳ Joining group on ${chainName}... This might take up to a minute`
      );
      const loadingMsgId = loadingMsg.message_id;

      try {
        // Join group using blockchain-agnostic service
        const joinResult = await blockchainService.joinGroup(ctx, groupAddress);
        console.log("joinResult", joinResult);

        if (joinResult.success && joinResult.data) {
          // Add member to database
          group.members.push({
            user_id: userId,
            joined_at: new Date(),
          });
          await group.save();

          // Get contribution from group info
          const groupInfo = await blockchainService.fetchGroupInfo(groupAddress);
          const contribution = groupInfo.success && groupInfo.data
            ? groupInfo.data.minimumDeposit
            : 0;

          const successMessage = `
<b>✅ Successfully Joined Group!</b>

<b>Group Name:</b> ${group.name}
<b>Blockchain:</b> ${chainName}

<b>Group Address:</b> <code>${groupAddress}</code>

<b>💰 Your Contribution:</b> ${contribution.toFixed(4)} ${currency}

<b>👥 Total Members:</b> ${group.members.length}

<b>Transaction Hash:</b> <code>${joinResult.transactionHash || joinResult.data.hash || "N/A"}</code>

You are now a member of this group! 🚀
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
<b>❌ Failed to join group on ${chainName}</b>

<b>Group:</b> ${group.name}
<b>Group Address:</b> <code>${groupAddress}</code>

<b>Reason:</b> ${joinResult.error || "Unknown error occurred"}

Please make sure you have enough ${currency} for the minimum deposit and gas fees.
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
        console.error(`Error joining ${chainName} group:`, error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        try {
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            loadingMsgId,
            undefined,
            `<b>❌ An error occurred while joining the group</b>

<b>Error:</b> ${errorMessage}

Please try again later.`,
            { parse_mode: "HTML" }
          );
        } catch (editError) {
          await ctx.reply(
            `❌ An error occurred while joining the group: ${errorMessage}`
          );
        }
      }
    } catch (error) {
      console.error("Join group error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to join group: ${errorMessage}`);
    }
  }
}
