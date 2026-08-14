import { Context, Markup } from "telegraf";
import { setDepositState, getDepositState, clearDepositState } from "@shared/state";
import {
  initiateOnRamp,
  getQuote,
} from "@features/payments/utils/SwitchService";
import getUser from "@features/users/getUserInfo";
import { safeDeleteMessage } from "@shared/utils/messageUtils";
import { sendOrEdit } from "@shared/utils/messageHelper";
import Deposit from "@core/database/models/deposit";

function formatAssetName(asset: string): string {
  const map: Record<string, string> = {
    'base:usdc': 'USDC on Base',
    'solana:usdc': 'USDC on Solana',
    'solana:usdt': 'USDT on Solana'
  };
  return map[asset] || asset.toUpperCase();
}

export async function handleFromBank(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();

    const message = "*Select Asset to Deposit*\n\nPlease choose which asset you want to receive:";

    await sendOrEdit(ctx, message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("USDC on Base", "deposit_select_asset:base:usdc"),
        ],
        [
          Markup.button.callback("USDC on Solana", "deposit_select_asset:solana:usdc"),
          Markup.button.callback("USDT on Solana", "deposit_select_asset:solana:usdt"),
        ],
        [Markup.button.callback("❌ Cancel", "delete_message")]
      ])
    });
  } catch (error) {
    console.error("Error handling bank deposit callback:", error);
    await ctx.answerCbQuery("❌ Error processing request");
  }
}

export async function handleAssetSelection(ctx: Context): Promise<void> {
  try {
    const cbData = (ctx.callbackQuery as any).data;
    const asset = cbData.split(":")[1] + ":" + cbData.split(":")[2];

    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    setDepositState(telegramId, 'awaiting_amount', { asset: asset as any });

    const assetName = formatAssetName(asset);
    await ctx.answerCbQuery();
    await sendOrEdit(ctx, `Please enter the amount in NGN you want to deposit. The minimum deposit amount is ₦2000 for *${assetName}*.\n\nExample: 5000`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Error handling asset selection:", error);
    await ctx.reply("❌ Error processing selection");
  }
}

export async function handleAmountInput(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;
    const messageText = (ctx.message as any)?.text;

    if (!telegramId || !messageText) return;

    const state = getDepositState(telegramId);
    if (!state || state.step !== 'awaiting_amount') return;

    const amount = parseFloat(messageText);
    if (isNaN(amount)) {
      await ctx.reply("❌ Invalid amount. Please enter a valid number greater than 0");
      return;
    }
    if (amount < 2000) {
      await ctx.reply("❌ Invalid amount. Minimum deposit amount is ₦2000");
      return;
    }
    if (amount > 1000000) {
      await ctx.reply("❌ Invalid amount. Maximum deposit amount is ₦1,000,000");
      return;
    }

    setDepositState(telegramId, 'awaiting_amount', { ...state.data, amount });

    const asset = state.data.asset;
    const assetName = formatAssetName(asset!);
    await ctx.sendChatAction("typing");

    const quote = await getQuote(amount, asset!);
    const estimatedAmount = quote.success && quote.data
      ? `${quote.data.destination.amount} ${quote.data.destination.currency}`
      : "Calculating...";

    await sendOrEdit(ctx, `*Confirm Deposit Details*\n\n` +
      `You Pay: \`₦${amount.toLocaleString()}\`\n\n` +
      `You Receive: \`approximately ${estimatedAmount} ${assetName}\`\n\n` +
      `Do you want to proceed?`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("✅ Yes", "deposit_confirm"), Markup.button.callback("❌ No", "delete_message")]
        ])
      }
    );

  } catch (error) {
    console.error("Error handling amount input:", error);
    await ctx.reply("❌ Error processing amount");
  }
}

export async function handleConfirmation(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

    if (!telegramId) return;

    const state = getDepositState(telegramId);
    if (!state || !state.data.amount || !state.data.asset) {
      await ctx.reply("❌ Session expired. Please start over.");
      return;
    }

    await ctx.answerCbQuery("🔄 Initiating transaction...");
    await ctx.sendChatAction("typing");

    const user = await getUser(telegramId, username);

    const response = await initiateOnRamp(
      state.data.amount,
      state.data.asset,
      user
    );

    if (response.success && response.data) {
      const deposit = response.data.deposit;
      const reference = response.data.reference;
      const destination = response.data.destination;
      const receiveAmount = destination ? `${destination.amount} ${destination.currency}` : "tokens";

      try {
        await Deposit.create({
          telegram_id: telegramId,
          reference: reference,
          amount: state.data.amount,
          currency: 'NGN',
          asset: state.data.asset,
          destination_amount: destination?.amount || 0,
          destination_currency: destination?.currency || 'UNKNOWN',
          bank_name: deposit.bank_name,
          account_number: deposit.account_number,
          account_name: deposit.account_name,
          status: 'AWAITING_DEPOSIT'
        });
        console.log(`[DepositCallbacks] Saved deposit record for ${telegramId}, ref: ${reference}`);
      } catch (dbError) {
        console.error("[DepositCallbacks] Failed to save deposit record:", dbError);
      }

      const msg = `✅ *Deposit Initiated*\n\n` +
        `Please transfer exactly \`₦${state.data.amount.toLocaleString()}\` to the account provided below:\n\n` +
        `Bank: *${deposit.bank_name}*\n` +
        `Account Number: \`${deposit.account_number}\`\n` +
        `Account Name: ${deposit.account_name}\n\n` +
        `You will receive exactly *${receiveAmount}*\n\n` +
        `⚠️ Use the reference below as the **Transaction Description / Narration**.\n\n` +
        `Reference: \`${reference}\``;

      await sendOrEdit(ctx, msg, { parse_mode: "Markdown" });
      clearDepositState(telegramId);
    } else {
      await ctx.reply(`❌ Failed to initiate deposit: ${response.message}`);
    }
  } catch (error) {
    console.error("Error handling confirmation:", error);
    await ctx.reply("❌ An unexpected error occurred");
  }
}
