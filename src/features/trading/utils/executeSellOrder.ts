import {
  Keypair, Connection, LAMPORTS_PER_SOL, VersionedTransaction
} from "@solana/web3.js";
import { Context } from "telegraf";
import getUser from '@features/users/getUserInfo';
import { decryptPrivateKey } from '@shared/utils/encryption';
import { config } from '@core/config/environment';
import Trade from "@core/database/models/Trade";
import { getOrderState, clearOrderState } from "@shared/state";

const connection = new Connection(config.solMainnet, 'confirmed');

export async function executeSellOrder(ctx: Context, transactionBase64: string, requestId: string) {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

  if (!telegramId) {
    return {
      success: false,
      error: "Unable to identify your account.",
    };
  }

  const user = await getUser(telegramId, username);

  if (!user) {
    return {
      success: false,
      error: "User not found. Please use /start to register first.",
    };
  }
  const privKey = decryptPrivateKey(user.solanaWallets[0].encryptedPrivateKey);
  try {
    const fromWallet = Keypair.fromSecretKey(Buffer.from(privKey, 'hex'));

    const tx = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));
    tx.sign([fromWallet]);
    const signedTransaction = Buffer.from(tx.serialize()).toString('base64');
    const executeResponse = await (
      await fetch('https://lite-api.jup.ag/ultra/v1/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signedTransaction: signedTransaction,
          requestId,
        }),
      })
    ).json();

    if (executeResponse.signature) {
      console.log('Sell Order executed:', JSON.stringify(executeResponse, null, 2));
      console.log(`https://solscan.io/tx/${executeResponse.signature}`);

      // Retrieve order state to get all trade details
      const orderState = getOrderState(telegramId);

      if (orderState) {
        console.log("orderState (SELL)", orderState);
        try {
          // Convert to human-readable amounts
          const actualSolReceived = parseInt(executeResponse.totalOutputAmount || executeResponse.outputAmountResult);
          const tokenAmountHuman = orderState.tokenAmount / Math.pow(10, orderState.decimals);
          const solReceivedHuman = actualSolReceived / LAMPORTS_PER_SOL;

          // Calculate correct prices (SOL per token, USD per token)
          const priceNative = solReceivedHuman / tokenAmountHuman;
          const priceUsd = orderState.amountUsd / tokenAmountHuman;

          // Calculate fees with fallbacks to prevent NaN
          const feeNativeValue = orderState.feeNative || 0;
          const feeNativeSol = feeNativeValue / LAMPORTS_PER_SOL;

          // Calculate fee in USD (approximate based on ratio)
          let feeUsd = 0;
          if (feeNativeValue > 0 && orderState.amountNative > 0 && orderState.amountUsd > 0) {
            feeUsd = (feeNativeValue / orderState.amountNative) * orderState.amountUsd;
          }

          console.log('💾 Saving SELL trade:', {
            tokenAmountHuman,
            solReceivedHuman,
            priceNative,
            priceUsd,
            feeNative: feeNativeSol,
            feeUsd,
            amountUsd: orderState.amountUsd
          });

          // Save trade to database
          await Trade.create({
            telegram_id: telegramId,
            type: "SELL",
            chain: "solana",
            tokenAddress: orderState.tokenAddress,
            symbol: orderState.symbol,
            amountNative: solReceivedHuman, // SOL received
            amountUsd: orderState.amountUsd,
            tokenAmount: tokenAmountHuman, // tokens sold
            priceNative,
            priceUsd,
            slippage_used: orderState.slippageBps,
            status: "SUCCESS",
            txHash: executeResponse.signature,
            feeNative: feeNativeSol,
            walletAddress: user.solanaWallets[0].address,
          });

          console.log(`✅ SELL Trade saved to database for user ${telegramId}`);
        } catch (dbError) {
          console.error('❌ Failed to save SELL trade to database:', dbError);
          // Don't fail the transaction if DB save fails
        }
      } else {
        console.warn('⚠️ OrderState not found, SELL trade not saved to database');
      }


      return {
        success: true,
        explorerUrl: `https://solscan.io/tx/${executeResponse.signature}`,
        amountReceived: executeResponse.totalOutputAmount, // in smallest unit (e.g., lamports)
      };
    } else {
      console.error('Swap failed:', JSON.stringify(executeResponse, null, 2));
      return {
        success: false,
        error: executeResponse.error?.message || "Unknown error"
      };
    }
  } catch (error: any) {
    console.error('❌ Transfer failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
