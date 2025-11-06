import { Context, Markup } from "telegraf";
import { getGroupByChatId, isUserTrader } from "@modules/ajo-groups/groupService";
import { distributeProfit, deriveGroupPDA, fetchGroupAccount } from "@blockchain/solana";
import { PublicKey } from "@solana/web3.js";
import AjoGroup from "@database/models/ajoGroup";
import User from "@database/models/user";

// Store temporary distribute profit data
const distributeProfitState = new Map<number, { groupId: string; step: string; selectedMember?: number; amount?: string }>();

export class DistributeProfitHandlers {
  /**
   * Handle distribute profit callback
   */
  static async handleDistributeProfit(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("💸 Distribute Profit");

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

      // Check if user is a trader
      const isTrader = await isUserTrader(group._id.toString(), userId);
      if (!isTrader) {
        await ctx.reply(
          "❌ <b>Permission Denied</b>\n\n" +
          "Only traders can distribute profits to members.",
          { parse_mode: "HTML" }
        );
        return;
      }

      // Get list of all members (including the trader)
      const allMembers = group.members;

      if (allMembers.length === 0) {
        await ctx.reply(
          "❌ <b>No Members Found</b>\n\n" +
          "There are no members in the group to distribute profits to.",
          { parse_mode: "HTML" }
        );
        return;
      }

      // Store state
      distributeProfitState.set(userId, {
        groupId: group._id.toString(),
        step: "awaiting_member_selection",
      });

      const distributeMessage = `
💸 <b>Distribute Profit - ${group.name}</b>

<b>Current Group Balance:</b> ${group.current_balance || 0} SOL

Select a member to distribute profit to:
      `;

      // Create inline keyboard with member options (max 2 per row)
      const memberButtons = [];
      for (let i = 0; i < allMembers.length; i += 2) {
        const row = [];

        // First member in row
        const member1 = allMembers[i];
        const user1 = await User.findOne({ telegram_id: member1.user_id });
        const name1 = user1?.username || `User ${member1.user_id}`;
        const isSelf1 = member1.user_id === userId ? " (You)" : "";
        row.push(Markup.button.callback(
          `👤 ${name1}${isSelf1} (${member1.contribution?.toFixed(2) || 0} SOL)`,
          `distribute_select_member_${member1.user_id}`
        ));

        // Second member in row (if exists)
        if (i + 1 < allMembers.length) {
          const member2 = allMembers[i + 1];
          const user2 = await User.findOne({ telegram_id: member2.user_id });
          const name2 = user2?.username || `User ${member2.user_id}`;
          const isSelf2 = member2.user_id === userId ? " (You)" : "";
          row.push(Markup.button.callback(
            `👤 ${name2}${isSelf2} (${member2.contribution?.toFixed(2) || 0} SOL)`,
            `distribute_select_member_${member2.user_id}`
          ));
        }

        memberButtons.push(row);
      }

      memberButtons.push([Markup.button.callback("❌ Cancel", "distribute_cancel")]);

      const keyboard = Markup.inlineKeyboard(memberButtons);

      await ctx.reply(distributeMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } catch (error) {
      console.error("Distribute profit error:", error);
      await ctx.answerCbQuery("❌ Failed to initiate profit distribution.");
    }
  }

  /**
   * Handle member selection for profit distribution
   */
  static async handleMemberSelection(ctx: Context, memberUserId: string): Promise<void> {
    try {
      await ctx.answerCbQuery(`Selected member ${memberUserId}`);

      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      // Get state
      const state = distributeProfitState.get(userId);
      if (!state) {
        await ctx.reply("❌ Distribution session expired. Please start again with /group");
        return;
      }

      // Update state with selected member
      distributeProfitState.set(userId, {
        ...state,
        selectedMember: parseInt(memberUserId),
        step: "awaiting_amount",
      });

      // Get member info
      const group = await AjoGroup.findById(state.groupId);
      const member = group?.members.find((m: any) => m.user_id === parseInt(memberUserId));
      const memberUser = await User.findOne({ telegram_id: parseInt(memberUserId) });
      const memberName = memberUser?.username || `User ${memberUserId}`;

      const amountMessage = `
💸 <b>Distribute Profit</b>

<b>Recipient:</b> ${memberName}
<b>Current Contribution:</b> ${member?.contribution?.toFixed(4) || 0} SOL

Choose an amount to distribute or enter a custom amount:
      `;

      // Create inline keyboard with amount options
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("0.01 SOL", "distribute_amount_0.01"),
          Markup.button.callback("0.05 SOL", "distribute_amount_0.05"),
        ],
        [
          Markup.button.callback("0.1 SOL", "distribute_amount_0.1"),
          Markup.button.callback("0.5 SOL", "distribute_amount_0.5"),
        ],
        [
          Markup.button.callback("1 SOL", "distribute_amount_1"),
          Markup.button.callback("5 SOL", "distribute_amount_5"),
        ],
        [Markup.button.callback("💱 Custom Amount", "distribute_custom")],
        [Markup.button.callback("❌ Cancel", "distribute_cancel")],
      ]);

      await ctx.reply(amountMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } catch (error) {
      console.error("Member selection error:", error);
      await ctx.answerCbQuery("❌ Failed to select member.");
    }
  }

  /**
   * Handle amount selection
   */
  static async handleAmountSelection(ctx: Context, amount: string): Promise<void> {
    try {
      await ctx.answerCbQuery(`💸 Distributing ${amount} SOL`);

      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      // Get state
      const state = distributeProfitState.get(userId);
      if (!state || !state.selectedMember) {
        await ctx.reply("❌ Distribution session expired. Please start again with /group");
        return;
      }

      // Get member info
      const memberUser = await User.findOne({ telegram_id: state.selectedMember });
      const memberName = memberUser?.username || `User ${state.selectedMember}`;

      const confirmMessage = `
<b>Confirm Profit Distribution</b>

<b>Recipient:</b> ${memberName}
<b>Amount:</b> ${amount} SOL

<b>Note:</b> This will transfer <b>${amount} SOL</b> from the group balance directly to the member's wallet (after exit penalty is applied).

<b>Important:</b> The member's contribution share in the group will NOT change.

Are you sure you want to distribute <b>${amount} SOL</b> to this member?
      `;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Confirm", `distribute_confirm_${amount}`),
          Markup.button.callback("❌ Cancel", "distribute_cancel"),
        ],
      ]);

      await ctx.reply(confirmMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } catch (error) {
      console.error("Amount selection error:", error);
      await ctx.answerCbQuery("❌ Failed to process amount.");
    }
  }

  /**
   * Handle custom amount input
   */
  static async handleCustomAmount(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("💱 Custom Amount");

      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      const customMessage = `
💱 <b>Enter Custom Amount</b>

Please enter the amount of SOL you want to distribute:

<b>Format:</b> Send a message with just the number
<b>Example:</b> <code>0.25</code> or <code>1.5</code>

<b>Minimum:</b> 0.01 SOL
<b>Note:</b> The amount will be deducted from the group balance

<b>To cancel:</b> Send <code>cancel</code> or use /group to go back
      `;

      await ctx.reply(customMessage, { parse_mode: "HTML" });

      // Update state to await custom input
      const state = distributeProfitState.get(userId);
      if (state) {
        distributeProfitState.set(userId, { ...state, step: "awaiting_custom_amount" });
      }
    } catch (error) {
      console.error("Custom amount error:", error);
      await ctx.answerCbQuery("❌ Failed to show custom amount input.");
    }
  }

  /**
   * Handle profit distribution confirmation
   */
  static async handleDistributeConfirm(ctx: Context, amount: string): Promise<void> {
    try {
      await ctx.answerCbQuery("⏳ Processing distribution...");

      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Get state
      const state = distributeProfitState.get(userId);
      if (!state || !state.selectedMember) {
        await ctx.reply("❌ Distribution session expired. Please start again with /group");
        return;
      }

      // Get group
      const group = await getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Verify user is still a trader
      const isTrader = await isUserTrader(group._id.toString(), userId);
      if (!isTrader) {
        await ctx.reply("❌ Only traders can distribute profits.");
        distributeProfitState.delete(userId);
        return;
      }

      // Get recipient's wallet
      const recipientUser = await User.findOne({ telegram_id: state.selectedMember });
      if (!recipientUser || !recipientUser.solanaWallets || recipientUser.solanaWallets.length === 0) {
        await ctx.reply(
          "❌ <b>Recipient's wallet not found.</b>\n\n" +
          "The recipient needs to have a Solana wallet registered.",
          { parse_mode: "HTML" }
        );
        distributeProfitState.delete(userId);
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
        distributeProfitState.delete(userId);
        return;
      }

      const creatorPubkey = new PublicKey(creator.solanaWallets[0].address);
      const [groupPDA] = deriveGroupPDA(group.name, creatorPubkey);
      const recipientPubkey = new PublicKey(recipientUser.solanaWallets[0].address);

      const recipientName = recipientUser.username || `User ${state.selectedMember}`;

      const processingMessage = `
⏳ <b>Processing Profit Distribution</b>

<b>Recipient:</b> ${recipientName}
<b>Amount:</b> ${amount} SOL
<b>Group:</b> ${group.name}
<b>Status:</b> Processing...

<b>Please wait...</b>
      `;

      await ctx.reply(processingMessage, { parse_mode: "HTML" });

      try {
        // Call blockchain distribute profit function
        const result = await distributeProfit({
          telegramId: userId,
          groupPDA: groupPDA.toBase58(),
          recipientPubkey: recipientPubkey.toBase58(),
          amount: parseFloat(amount)
        });

        // Fetch actual group balance from blockchain
        const groupAccount = await fetchGroupAccount(groupPDA.toBase58(), userId);
        const actualBalance = parseFloat(groupAccount.totalContributions) / 1_000_000_000;

        // Update group balance in database with actual blockchain data
        // Note: We do NOT update member contribution because profit goes directly to wallet
        await AjoGroup.findByIdAndUpdate(group._id, {
          current_balance: actualBalance
        });

        const successMessage = `
✅ <b>Profit Distributed Successfully!</b>

<b>Recipient:</b> ${recipientName}
<b>Amount Distributed:</b> ${amount} SOL
<b>New Group Balance:</b> ${actualBalance.toFixed(2)} SOL
<b>Transaction Signature:</b> <code>${result.signature}</code>

The profit has been sent directly to the member's wallet (after exit penalty).

<b>Note:</b> The member's contribution share in the group remains unchanged.

<b>View on Solscan:</b>
https://solscan.io/tx/${result.signature}
        `;

        await ctx.reply(successMessage, { parse_mode: "HTML" });

        // Clear state
        distributeProfitState.delete(userId);

      } catch (blockchainError: any) {
        console.error("Blockchain distribute profit error:", blockchainError);

        let errorMessage = "❌ <b>Profit Distribution Failed</b>\n\n";

        // Check for specific Anchor error codes
        if (blockchainError.error?.errorCode?.number === 6009) {
          errorMessage += "<b>Reason:</b> Only traders can distribute profits\n\n";
          errorMessage += "You must be assigned as a trader to perform this action.";
        } else if (blockchainError.message?.includes("Insufficient SOL")) {
          errorMessage += "<b>Reason:</b> Insufficient SOL balance for transaction fees.\n\n";
          errorMessage += "Please fund your wallet and try again.";
        } else if (blockchainError.message?.includes("User not found")) {
          errorMessage += "<b>Reason:</b> User account not found.\n\n";
          errorMessage += "Please register using /start first.";
        } else if (blockchainError.message?.includes("timeout")) {
          errorMessage += "<b>Reason:</b> Transaction timed out.\n\n";
          errorMessage += "The transaction may still succeed on-chain. Please check the group balance in a few moments.";
        } else {
          errorMessage += `<b>Reason:</b> ${blockchainError.error?.errorMessage || blockchainError.message || "Unknown error"}\n\n`;
          errorMessage += "Please try again or contact support if the issue persists.";
        }

        await ctx.reply(errorMessage, { parse_mode: "HTML" });

        // Clear state
        distributeProfitState.delete(userId);
      }

    } catch (error) {
      console.error("Distribute confirm error:", error);
      await ctx.reply("❌ Failed to distribute profit. Please try again.");

      // Clear state
      const userId = ctx.from?.id;
      if (userId) distributeProfitState.delete(userId);
    }
  }

  /**
   * Handle distribution cancellation
   */
  static async handleDistributeCancel(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("❌ Distribution Cancelled");

      const userId = ctx.from?.id;
      if (userId) {
        distributeProfitState.delete(userId);
      }

      await ctx.reply(
        "❌ Profit distribution cancelled.\n\nUse <code>/group</code> to return to group management.",
        { parse_mode: "HTML" }
      );
    } catch (error) {
      console.error("Distribute cancel error:", error);
      await ctx.answerCbQuery("❌ Failed to cancel distribution.");
    }
  }
}
