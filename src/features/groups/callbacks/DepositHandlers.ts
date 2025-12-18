import { Context, Markup } from "telegraf";
import { BlockchainServiceFactory } from "@blockchain/shared/BlockchainServiceFactory";
import { BlockchainDetector } from "@blockchain/shared/utils";
import Group from "@core/database/models/group";
import User from "@core/database/models/user";
import { GroupService } from "@features/groups/services/groupService";

// Store temporary deposit data
const depositState = new Map<number, { groupId: string; step: string }>();

export class DepositHandlers {
  /**
   * Handle deposit funds callback
   */
  static async handleDepositFunds(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("💰 Deposit Funds");

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
        await ctx.reply("❌ You must be a member of this group to deposit funds.");
        return;
      }

      // Store deposit state
      depositState.set(userId, {
        groupId: group._id.toString(),
        step: "awaiting_amount",
      });

      // Get blockchain service to determine currency
      const blockchainService = BlockchainServiceFactory.detectAndGetService(group.group_address);
      const currency = blockchainService.getNativeCurrency();

      const depositMessage = `<b>Add Funds to Group - ${group.name}</b>

<b>Current Group Balance:</b> ${0} ${currency}
<b>Your Current Contribution:</b> Check with <code>/balance</code>

Choose an amount or enter a custom amount to increase your contribution in the group

      `;

      // Create inline keyboard with deposit options
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(`0.01 ${currency}`, "deposit_amount_0.01"),
          Markup.button.callback(`0.05 ${currency}`, "deposit_amount_0.05"),
        ],
        [
          Markup.button.callback(`0.1 ${currency}`, "deposit_amount_0.1"),
          Markup.button.callback(`0.5 ${currency}`, "deposit_amount_0.5"),
        ],
        [
          Markup.button.callback(`1 ${currency}`, "deposit_amount_1"),
          Markup.button.callback(`5 ${currency}`, "deposit_amount_5"),
        ],
        [Markup.button.callback("💱 Custom Amount", "deposit_custom")],
        [Markup.button.callback("❌ Cancel", "deposit_cancel")],
      ]);

      await ctx.reply(depositMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } catch (error) {
      console.error("Deposit funds error:", error);
      await ctx.answerCbQuery("❌ Failed to initiate deposit.");
    }
  }

  /**
   * Handle deposit amount selection
   */
  static async handleDepositAmount(ctx: Context, amount: string): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Get deposit state
      const state = depositState.get(userId);
      if (!state) {
        await ctx.reply("❌ Deposit session expired. Please start again with /group");
        return;
      }

      // Get group to determine blockchain
      const group = await GroupService.getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Get blockchain service to determine currency
      const blockchainService = BlockchainServiceFactory.detectAndGetService(group.group_address);
      const currency = blockchainService.getNativeCurrency();

      await ctx.answerCbQuery(`💰 Depositing ${amount} ${currency}`);

      const confirmMessage = `<b>Confirm Deposit</b>

<b>Amount:</b> ${amount} ${currency}
<b>Group:</b> ${state.groupId}

<b>Note:</b> This will transfer <b>${amount} ${currency}</b> from your wallet and add it to the group balance.

Are you sure you want to deposit <b>${amount} ${currency}</b>?
      `;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Confirm", `deposit_confirm_${amount}`),
          Markup.button.callback("❌ Cancel", "deposit_cancel"),
        ],
      ]);

      await ctx.reply(confirmMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } catch (error) {
      console.error("Deposit amount error:", error);
      await ctx.answerCbQuery("❌ Failed to process deposit amount.");
    }
  }

  /**
   * Handle custom deposit amount
   */
  static async handleDepositCustom(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("💱 Custom Amount");

      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Get group to determine blockchain
      const group = await GroupService.getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Get blockchain service to determine currency
      const blockchainService = BlockchainServiceFactory.detectAndGetService(group.group_address);
      const currency = blockchainService.getNativeCurrency();

      const customMessage = `
💱 <b>Enter Custom Amount</b>

Please enter the amount of ${currency} you want to deposit:

<b>Format:</b> Send a message with just the number
<b>Example:</b> <code>0.25</code> or <code>1.5</code>

<b>Minimum:</b> 0.01 ${currency}
<b>Note:</b> The amount will be deducted from your wallet

<b>To cancel:</b> Send <code>cancel</code> or use /group to go back
      `;

      await ctx.reply(customMessage, { parse_mode: "HTML" });

      // Update state to await custom input
      const state = depositState.get(userId);
      if (state) {
        depositState.set(userId, { ...state, step: "awaiting_custom_amount" });
      }
    } catch (error) {
      console.error("Deposit custom error:", error);
      await ctx.answerCbQuery("❌ Failed to show custom amount input.");
    }
  }

  /**
   * Handle deposit confirmation - Implements actual blockchain transaction
   */
  static async handleDepositConfirm(ctx: Context, amount: string): Promise<void> {
    try {
      await ctx.answerCbQuery("⏳ Processing deposit...");

      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Get deposit state
      const state = depositState.get(userId);
      if (!state) {
        await ctx.reply("❌ Deposit session expired. Please start again with /group");
        return;
      }

      // Get group
      const group = await GroupService.getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Get blockchain service based on group address
      const blockchainService = BlockchainServiceFactory.detectAndGetService(group.group_address);
      const currency = blockchainService.getNativeCurrency();
      const chainName = blockchainService.getDisplayName();

      const processingMessage = `
⏳ <b>Processing Deposit</b>

<b>Amount:</b> ${amount} ${currency}
<b>Group:</b> ${group.name}
<b>Blockchain:</b> ${chainName}
<b>Status:</b> Processing...

This will:
1. Deduct <b>${amount} ${currency}</b> from your wallet
2. Add <b>${amount} ${currency}</b> to the group balance
3. Update your contribution share

<b>Please wait...</b>
      `;

      await ctx.reply(processingMessage, { parse_mode: "HTML" });

      try {
        // Call blockchain-agnostic deposit function
        const result = await blockchainService.deposit(
          ctx,
          group.group_address,
          parseFloat(amount)
        );

        if (result.success && result.data) {
          // Fetch updated group info from blockchain
          const groupInfo = await blockchainService.fetchGroupInfo(group.group_address);

          const actualBalance = groupInfo.success && groupInfo.data
            ? groupInfo.data.totalContributions
            : 0;

          const successMessage = `
✅ <b>Deposit Successful!</b>

<b>Amount Deposited:</b> ${amount} ${currency}
<b>New Group Balance:</b> ${actualBalance.toFixed(4)} ${currency}
<b>Transaction Hash:</b> <code>${result.transactionHash || result.data.hash}</code>

Your contribution has been recorded on-chain and your share in the group has been updated.

Use <code>/balance</code> to see your updated balance.
          `;

          await ctx.reply(successMessage, { parse_mode: "HTML" });

          // Clear deposit state
          depositState.delete(userId);
        } else {
          throw new Error(result.error || "Deposit transaction failed");
        }

      } catch (blockchainError: any) {
        console.error("Blockchain deposit error:", blockchainError);

        let errorMessage = "❌ <b>Deposit Failed</b>\n\n";

        if (blockchainError.message?.includes("Insufficient")) {
          errorMessage += `<b>Reason:</b> Insufficient ${currency} balance in your wallet.\n\n`;
          errorMessage += "Please fund your wallet and try again.";
        } else if (blockchainError.message?.includes("below the minimum required")) {
          errorMessage += `<b>Reason:</b> ${blockchainError.message}\n\n`;
          errorMessage += "Please deposit a larger amount or ask the group owner to adjust the minimum deposit.";
        } else if (blockchainError.message?.includes("User not found")) {
          errorMessage += "<b>Reason:</b> User account not found.\n\n";
          errorMessage += "Please register using /start first.";
        } else if (blockchainError.message?.includes("timeout")) {
          errorMessage += "<b>Reason:</b> Transaction timed out.\n\n";
          errorMessage += "The transaction may still succeed on-chain. Please check your wallet balance in a few moments.";
        } else {
          errorMessage += `<b>Reason:</b> ${blockchainError.message || "Unknown error"}\n\n`;
          errorMessage += "Please try again or contact support if the issue persists.";
        }

        await ctx.reply(errorMessage, { parse_mode: "HTML" });

        // Clear deposit state
        depositState.delete(userId);
      }

    } catch (error) {
      console.error("Deposit confirm error:", error);
      await ctx.reply("❌ Failed to process deposit. Please try again.");

      // Clear deposit state
      const userId = ctx.from?.id;
      if (userId) depositState.delete(userId);
    }
  }

  /**
   * Handle deposit cancellation
   */
  static async handleDepositCancel(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("❌ Deposit Cancelled");

      const userId = ctx.from?.id;
      if (userId) {
        depositState.delete(userId);
      }

      await ctx.reply(
        "❌ Deposit cancelled.\n\nUse <code>/group</code> to return to group management.",
        { parse_mode: "HTML" }
      );
    } catch (error) {
      console.error("Deposit cancel error:", error);
      await ctx.answerCbQuery("❌ Failed to cancel deposit.");
    }
  }
}
