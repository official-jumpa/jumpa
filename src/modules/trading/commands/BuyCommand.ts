import { Context, Markup } from "telegraf";
import { createBuyOrder } from "@modules/trading/utils/createBuyOrder";
import { runTrade } from "./testExecuteTrade";

export async function handleBuy(ctx: Context) {
  try {
    const callbackData = (ctx.callbackQuery as any).data;
    const parts = callbackData.split(":");
    const tradeId = parts[1];
    const amount = parseFloat(parts[2]);

    if (!tradeId || isNaN(amount)) {
      await ctx.answerCbQuery("Invalid buy command.");
      return;
    }

    await createBuyOrder(ctx, tradeId, amount);

  } catch (error) {
    console.error("Error in handleBuy:", error);
    await ctx.answerCbQuery("An unexpected error occurred.");
  }
}

export async function handleGroupBuy(ctx: Context) {
  //just return a message for now
  try {
    // const callbackData = (ctx.callbackQuery as any).data;
    // const parts = callbackData.split(":");
    // const tradeId = parts[1];
    // const amount = parseFloat(parts[2]);

    // if (!tradeId || isNaN(amount)) {
    //   await ctx.answerCbQuery("Invalid buy command.");
    //   return;
    // }

    // await createBuyOrder(ctx, tradeId, amount);
    await runTrade();
    const orderDetails = `
<b>Order Details</b>
-------------------
Group buy and sell feature is coming soon...
`;

    await ctx.replyWithHTML(
      orderDetails,
      Markup.inlineKeyboard([
        Markup.button.callback("Coming Soon", `coming_soon`),
        Markup.button.callback("Coming Soon", "coming_soon"),
      ])
    );
  } catch (error) {
    console.error("Error in handleBuy:", error);
    await ctx.answerCbQuery("An unexpected error occurred.");
  }
}