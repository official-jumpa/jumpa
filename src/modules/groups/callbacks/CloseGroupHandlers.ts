import { Context, Markup } from "telegraf";
import { getGroupByChatId, isUserTrader } from "@modules/groups/groupService";
import { closeGroup, deriveGroupPDA } from "@blockchain/solana";
import { PublicKey } from "@solana/web3.js";
import Group from "@database/models/group";
import User from "@database/models/user";

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
      const group = await getGroupByChatId(chatId);
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

      // Check if group is already ended
      if (group.status === "ended") {
        await ctx.reply(
          "❌ <b>Group Already Closed</b>\n\n" +
          "This group has already been closed.",
          { parse_mode: "HTML" }
        );
        return;
      }

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
• <b>Members:</b> ${group.members.length}/${group.max_members}
• <b>Balance:</b> ${group.current_balance || 0} SOL

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
      const group = await getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Verify user is creator
      if (group.creator_id !== userId) {
        await ctx.reply("❌ Only the group creator can close the group.");
        return;
      }

      // Check if already closed
      if (group.status === "ended") {
        await ctx.reply("❌ This group has already been closed.");
        return;
      }

      // Get the group creator's Solana wallet to derive the PDA
      const creator = await User.findOne({ telegram_id: group.creator_id });
      if (!creator || !creator.solanaWallets || creator.solanaWallets.length === 0) {
        await ctx.reply(
          "❌ <b>Group creator's wallet not found.</b>\n\n" +
          "The group creator needs to have a Solana wallet registered.",
          { parse_mode: "HTML" }
        );
        return;
      }

      const creatorPubkey = new PublicKey(creator.solanaWallets[0].address);
      const [groupPDA] = deriveGroupPDA(group.name, creatorPubkey);

      const processingMessage = `
⏳ <b>Closing Group</b>

<b>Group:</b> ${group.name}
<b>Status:</b> Processing...

<b>Please wait...</b>
      `;

      await ctx.reply(processingMessage, { parse_mode: "HTML" });

      try {
        // Call blockchain close group function
        const result = await closeGroup({
          telegramId: userId,
          groupPDA: groupPDA.toBase58(),
        });

        // Update group status in database
        await Group.findByIdAndUpdate(group._id, {
          status: "ended"
        });

        const successMessage = `
✅ <b>Group Closed Successfully!</b>

<b>Group:</b> ${group.name}
<b>Status:</b> Ended
<b>Final Balance:</b> ${group.current_balance || 0} SOL
<b>Transaction Signature:</b> <code>${result.signature}</code>

The group has been permanently closed on the blockchain.

<b>Next Steps for Members:</b>
• Members should use <code>/exit</code> to withdraw their funds
• No further deposits or transactions are allowed

<b>View on Solscan:</b>
https://solscan.io/tx/${result.signature}
        `;

        await ctx.reply(successMessage, { parse_mode: "HTML" });

      } catch (blockchainError: any) {
        console.error("Blockchain close group error:", blockchainError);

        let errorMessage = "❌ <b>Failed to Close Group</b>\n\n";

        if (blockchainError.message?.includes("Insufficient SOL")) {
          errorMessage += "<b>Reason:</b> Insufficient SOL balance for transaction fees.\n\n";
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
