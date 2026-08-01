import { Context } from "telegraf";
import { getOrderState, clearOrderState } from "@shared/state";
import { executeBuyOrder } from "@src/features/trading/utils/executeBuyOrder";

export async function handleApproveBuy(ctx: Context): Promise<void> {
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

  if (orderState.requestId !== requestId) {
    await ctx.reply("This approval is for a different order.");
    return;
  }

  await ctx.answerCbQuery("Executing order...");

  const result = await executeBuyOrder(ctx, orderState.transactionBase64, orderState.requestId);

  if (result.success) {
    const responseMsg = `✅ Swap successful!\n\n<a href="${result.explorerUrl}">View on Solscan</a>\n\nYou received ${(result.amountReceived / Math.pow(10, decimals)).toFixed(4)} ${symbol}`;

    await ctx.editMessageText(responseMsg, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: false },
    });
  } else {
    await ctx.editMessageText(`❌ Trade failed: ${result.error}`);
  }

  clearOrderState(ctx.from.id);
}

export async function handleDeclineBuy(ctx: Context): Promise<void> {
  if (!ctx.from) {
    await ctx.reply("User not found.");
    return;
  }
  await ctx.answerCbQuery("Order cancelled.");
  await ctx.editMessageText("Buy order has been cancelled.");
  clearOrderState(ctx.from.id);
}