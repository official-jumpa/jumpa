import { Context } from "telegraf";
import { BaseCommand } from "@telegram/commands/BaseCommand";
import Group from "@core/database/models/group";
import getUser from "@features/users/getUserInfo";
import { BlockchainServiceFactory } from "@blockchain/shared/BlockchainServiceFactory";
import { MessageFormatters } from "@features/groups/utils/messageFormatters";
import { GroupKeyboards } from "@features/groups/utils/groupKeyboards";

export class GroupCommand extends BaseCommand {
  name = "group";
  description = "Manage and view group information";

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

      // Get group from database
      const group = await Group.findOne({ telegram_chat_id: chatId });
      if (!group) {
        await ctx.reply(
          `<b>❌ No group found in this chat</b>

Create a group first using:
<code>/create base GroupName true</code>`,
          { parse_mode: "HTML" }
        );
        return;
      }

      // Check if group has a blockchain address
      if (!group.group_address) {
        await ctx.reply(
          "❌ This group doesn't have a blockchain address. Please create a new group."
        );
        return;
      }

      // Get blockchain service
      const blockchainService = BlockchainServiceFactory.detectAndGetService(group.group_address);

      // Send loading message
      const loadingMsg = await ctx.reply(
        MessageFormatters.formatLoading("Loading group information", blockchainService.getBlockchainType())
      );
      const loadingMsgId = loadingMsg.message_id;

      // Fetch group info using blockchain service
      try {
        const grpInfo = await blockchainService.fetchGroupInfo(group.group_address);
        console.log("grpInfo", grpInfo);

        if (grpInfo.success && grpInfo.data) {
          // Format message using unified formatter
          const groupMessage = MessageFormatters.formatGroupInfo(grpInfo.data);

          // Create keyboard using unified builder
          const keyboard = GroupKeyboards.createGroupKeyboard(grpInfo.data);

          // Replace loading message with group info and keyboard
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            loadingMsgId,
            undefined,
            groupMessage,
            {
              parse_mode: "HTML",
              ...keyboard,
            }
          );
        } else {
          // Format error message
          const errorMessage = MessageFormatters.formatError(
            "fetch group info",
            blockchainService.getBlockchainType(),
            group.group_address,
            grpInfo.error || "Unknown error occurred"
          );

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
        console.error("Error fetching group info:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        try {
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            loadingMsgId,
            undefined,
            MessageFormatters.formatError(
              "fetch group info",
              blockchainService.getBlockchainType(),
              group.group_address,
              errorMessage
            ),
            { parse_mode: "HTML" }
          );
        } catch (editError) {
          await ctx.reply(
            `❌ An error occurred while fetching group info: ${errorMessage}`
          );
        }
      }
    } catch (error) {
      console.error("Group command error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to process group command: ${errorMessage}`);
    }
  }
}
