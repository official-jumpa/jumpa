// for test only. Will be deleted later

import { Context } from 'telegraf';
import { generatePnlImage } from '@shared/utils/generatePnlImage';

export const pnlTestCommandConfig = {
  name: 'pnl',
  description: 'Test P/L image generation - Usage: /pnl profit or /pnl loss',
};

export async function handleProfitAndLossTestCommand(ctx: Context): Promise<void> {
  try {
    const message = (ctx.message as any)?.text || '';
    const args = message.split(' ');
    const scenario = args[1]?.toLowerCase();

    if (!scenario || !['profit', 'loss'].includes(scenario)) {
      await ctx.reply(
        '❌ Invalid usage.\n\n' +
        'Use:\n' +
        '• /pnl profit - Test profit scenario\n' +
        '• /pnl loss - Test loss scenario'
      );
      return;
    }

    await ctx.reply('Generating P/L image...');

    const profitData = {
      scenario: 'profit' as const,
      tokenSymbol: 'JUMPA',
      tokenAmount: '1,234,567',
      investedAmount: '$0.0076',
      currentValue: '0.00812',
      pnlPercent: '+134.26%',
      pnlAmount: '+75.50',
      entryPrice: '$0.0076',
      exitPrice: '0.00812',
      referralCode: 'ABCD',
      telegramHandle: '@jumpa_bot'
    };

    const lossData = {
      scenario: 'loss' as const,
      tokenSymbol: 'ASTER',
      tokenAmount: '5,000',
      investedAmount: '$0.15',
      currentValue: '$0.08',
      pnlPercent: '-540.80%',
      pnlAmount: '-540.80',
      entryPrice: '$0.15',
      exitPrice: '$0.008',
      referralCode: 'WXYZ',
      telegramHandle: '@jumpa_bot'
    };

    const data = scenario === 'profit' ? profitData : lossData;

    const imageBuffer = await generatePnlImage(data);

    await ctx.replyWithPhoto(
      { source: imageBuffer },
      {
        caption: `${scenario === 'profit' ? '🟢' : '🔴'} Test ${scenario.toUpperCase()} scenario`
      }
    );
  } catch (error) {
    console.error('Error generating P/L image:', error);
    await ctx.reply('❌ Failed to generate P/L image. Please try again.');
  }
}
