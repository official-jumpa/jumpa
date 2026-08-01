import { Context } from 'telegraf';
import { generateTransactionReceipt } from '@shared/utils/receiptGenerator';

export const imageTestCommandConfig = {
  name: 'image',
  description: 'Test receipt image generation',
};

export async function handleImageTestCommand(ctx: Context): Promise<void> {
  try {
    await ctx.reply('Generating receipt image...');

    const receiptData = {
      amount: "50,000",
      currency: "USDT",
      timestamp: new Date(),
      network: "Solana",
      fee: "0.005",
      bankName: "GTBank",
      accountName: "John Doe",
      accountNumber: "0123456789",
      amountInCrypto: "1200",
      transactionHash: "0xdefebgbnhtyrgrnmyt"
    };

    const imageBuffer = await generateTransactionReceipt(receiptData);

    await ctx.replyWithPhoto(
      { source: imageBuffer },
      { caption: '✅ Your transaction receipt' }
    );
  } catch (error) {
    console.error('Error generating receipt:', error);
    await ctx.reply('Failed to generate receipt image. Please try again.');
  }
}
