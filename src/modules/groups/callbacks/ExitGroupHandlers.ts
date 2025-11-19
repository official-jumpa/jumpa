import { Context, Markup } from "telegraf";
import { getGroupByChatId, isUserMember } from "@modules/groups/groupService";
import { exitGroup, deriveGroupPDA, fetchGroupAccount, fetchMemberProfile, deriveMemberProfilePDA } from "@blockchain/solana";
import { PublicKey } from "@solana/web3.js";
import Group from "@database/models/group";
import User from "@database/models/user";

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
      const group = await getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Check if user is a member
      const isMember = await isUserMember(group._id.toString(), userId);
      if (!isMember) {
        await ctx.reply("❌ You are not a member of this group.");
        return;
      }

      // Get member's contribution
      const member = group.members.find((m: any) => m.user_id === userId);
      const memberContribution = member?.contribution || 0;

      const warningMessage = `
🚪 <b>Exit Group - ${group.name}</b>

<b>⚠️ WARNING: This action will remove you from the group!</b>

Exiting the group will:
• Withdraw all your contribution and accumulated profit, if any, from the group
• Remove you from the member list
• You may incur an exit penalty based on group settings
• You cannot rejoin without an invitation

<b>Your Details:</b>
• <b>Your Contribution:</b> ${memberContribution.toFixed(4)} SOL
• <b>Role:</b> ${member?.role || "Member"}

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
      const group = await getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Verify user is a member
      const isMember = await isUserMember(group._id.toString(), userId);
      if (!isMember) {
        await ctx.reply("❌ You are not a member of this group.");
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

      const processingMessage = `
⏳ <b>Exiting Group</b>

<b>Group:</b> ${group.name}

<b>Status:</b> Processing...
<b>Please wait...</b>
      `;

      await ctx.reply(processingMessage, { parse_mode: "HTML" });

      try {
        // Call blockchain exit group function
        const result = await exitGroup({
          telegramId: userId,
          groupName: group.name,
          ownerPubkey: creatorPubkey.toBase58(),
        });

        // Fetch updated group balance from blockchain
        const [groupPDA] = deriveGroupPDA(group.name, creatorPubkey);
        const groupAccount = await fetchGroupAccount(groupPDA.toBase58(), userId);
        const actualBalance = parseFloat(groupAccount.totalContributions) / 1_000_000_000;

        // Remove member from database
        const updatedMembers = group.members.filter((m: any) => m.user_id !== userId);
        await Group.findByIdAndUpdate(group._id, {
          members: updatedMembers,
          current_balance: actualBalance,
        });

        const successMessage = `
✅ <b>Successfully Exited Group!</b>

<b>Group:</b> ${group.name}
<b>Status:</b> You have been removed from the group
<b>Transaction Signature:</b> <code>${result.signature}</code>

Your contribution has been withdrawn and sent back to your wallet.

Use <code>/wallet</code> to check your updated balance.

<b>View on Solscan:</b>
https://solscan.io/tx/${result.signature}
        `;

        await ctx.reply(successMessage, { parse_mode: "HTML" });

      } catch (blockchainError: any) {
        console.error("Blockchain exit group error:", blockchainError);

        let errorMessage = "❌ <b>Failed to Exit Group</b>\n\n";

        // Check for Anchor error code first (most specific)
        if (blockchainError.error?.errorCode?.number === 6013) {
          errorMessage += "<b>Reason:</b> Lock period is still active\n\n";
          errorMessage += "You must wait for <b>7 days</b> after joining before you can exit the group.\n\n";
        } else if (blockchainError.message?.includes("Insufficient SOL")) {
          errorMessage += "<b>Reason:</b> Insufficient SOL balance for transaction fees.\n\n";
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
