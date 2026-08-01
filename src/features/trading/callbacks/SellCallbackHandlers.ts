import { Context } from "telegraf";
import { getOrderState, clearOrderState } from "@shared/state";
import { executeSellOrder } from "@features/trading/utils/executeSellOrder";

export async function handleApproveSell(ctx: Context): Promise<void> {
  if (!ctx.from) {
    await ctx.reply("User not identified.");
    return;
  }

  const orderState = getOrderState(ctx.from.id);
  if (!orderState) {
    await ctx.reply("Order not found or has expired.");
    return;
  }

  const callbackData = (ctx.callbackQuery as any).data;
  const requestId = callbackData.split(":")[1];
  const decimals = parseInt(callbackData.split(":")[2]);
  const symbol = callbackData.split(":")[3];
  const solanaDecimals = 9;

  console.log("Approve sell called with requestId:", requestId, decimals, symbol);

  if (orderState.requestId !== requestId) {
    await ctx.reply("This approval is for a different order.");
    return;
  }

  await ctx.answerCbQuery("Executing order...");

  const result = await executeSellOrder(ctx, orderState.transactionBase64, orderState.requestId);

  if (result.success) {
    const responseMsg = `✅ Sell Order executed!\n\n<a href="${result.explorerUrl}">View on Solscan</a>\n\nYou received ${(result.amountReceived / Math.pow(10, solanaDecimals)).toFixed(6)} SOL`;

    await ctx.editMessageText(responseMsg, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: false },
    });
  } else {
    await ctx.editMessageText(`❌ Sell failed: ${result.error}`);
  }

  clearOrderState(ctx.from.id);
}

export async function handleDeclineSell(ctx: Context): Promise<void> {
  if (!ctx.from) {
    await ctx.reply("User not identified.");
    return;
  }
  await ctx.answerCbQuery("Sell cancelled .");
  await ctx.editMessageText("Sell order cancelled.");
  clearOrderState(ctx.from.id);
}