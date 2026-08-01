import { Context } from 'telegraf';
import { setUserActionState } from '@shared/state';

export async function handleBuyCustomAmountRequest(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) {
      await ctx.reply('User not identified.');
      return;
    }

    const callbackData = (ctx.callbackQuery as any).data;
    const tradeId = callbackData.split(':')[1];

    if (!tradeId) {
      await ctx.answerCbQuery('Error: Invalid trade session.');
      return;
    }

    setUserActionState(ctx.from.id, {
      action: 'awaiting_custom_buy_amount',
      tradeId: tradeId,
    });

    await ctx.answerCbQuery();
    await ctx.reply('Please enter the amount of SOL you wish to buy.');

  } catch (error) {
    console.error('Error in handleBuyCustomAmountRequest:', error);
    await ctx.reply('An unexpected error occurred.');
  }
}
