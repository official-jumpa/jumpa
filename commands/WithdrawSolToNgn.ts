import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { config } from '../config/config';
import getUser from '../services/getUserInfo';
import { Context } from 'telegraf';
import { decryptPrivateKey } from '../utils/encryption';

const connection = new Connection(config.solMainnet, 'confirmed');
// const signer = keypair.publicKey;


export async function WithdrawSolToNgn(ctx: Context, toAddress, amount) {
  console.log("initiating withdrawal...")
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

  if (!telegramId) {
    await ctx.answerCbQuery("❌ Unable to identify your account.");
    return;
  }

  const user = await getUser(telegramId, username);

  if (!user) {
    await ctx.reply(
      "❌ User not found. Please use /start to register first."
    );
    return;
  }
  const privKey = decryptPrivateKey(user.private_key);
  try {
    // 1. Load sender's wallet from private key
    const fromWallet = Keypair.fromSecretKey(Buffer.from(privKey, 'hex'));

    // 2. Validate recipient address
    let toPublicKey;
    try {
      toPublicKey = new PublicKey(toAddress);
    } catch (e) {
      return { success: false, error: 'Invalid recipient address' };
    }

    // 3. Check sender's balance
    const balance = await connection.getBalance(fromWallet.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;

    console.log(`Sender: ${fromWallet.publicKey.toString()}`);
    console.log(`Balance: ${solBalance} SOL`);
    console.log(`Recipient: ${toAddress}`);
    console.log(`Amount: ${amount} SOL`);

    // 4. Verify sufficient balance (amount + fee)
    const amountInLamports = amount * LAMPORTS_PER_SOL;
    const estimatedFee = 5000; // ~0.000005 SOL
    const totalNeeded = (amountInLamports + estimatedFee) / LAMPORTS_PER_SOL;

    if (balance < amountInLamports + estimatedFee) {
      return {
        success: false,
        error: `Insufficient balance. You have: ${solBalance.toFixed(2)} SOL, You need a minimum of ${totalNeeded.toFixed(6)} SOL to cover both transaction fee and amount you are trying to withdraw`
      };
    }

    // 5. Create transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromWallet.publicKey,
        toPubkey: toPublicKey,
        lamports: amountInLamports,
      })
    );

    // 6. Send and confirm transaction
    console.log('\n📤 Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromWallet],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );

    console.log('✅ Transfer successful!');
    console.log(`Transaction: ${signature}`);
    console.log(`View on Solscan: https://solscan.io/tx/${signature}`);

    // 7. Check new balances
    const newBalance = await connection.getBalance(fromWallet.publicKey);
    console.log(`\nNew sender balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);

    return {
      success: true,
      signature,
      fromAddress: fromWallet.publicKey.toString(),
      toAddress: toAddress,
      amount: amount,
      explorerUrl: `https://solscan.io/tx/${signature}`
    };

  } catch (error) {
    console.error('❌ Transfer failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}