import { Context, Markup } from "telegraf";
import {
  convertNGNToCrypto,
} from "@features/payments/utils/convertNGNToCrypto";
import {
  setAIWithdrawalState,
  getAIWithdrawalState,
  clearAIWithdrawalState,
  updateAIWithdrawalState,
} from "@shared/state";
import getUser from "@features/users/getUserInfo";
import { config } from "@core/config/environment";
import Withdrawal from "@core/database/models/withdrawal";
import {
  executeSolTransfer,
  executeUSDCTransfer,
  executeUSDTTransfer,
} from "@features/payments/utils/solWithdrawTx";
import {
  executeETHTransfer,
  executeUSDCTransferEVM,
  executeUSDTTransferEVM,
  executeCELOTransfer,
} from "@features/payments/utils/evmWithdrawTx";
import { findSwitchBankCode } from "@features/payments/utils/SwitchBankCodes";
import {
  initiateOfframp,
  confirmDeposit,
  formatAssetCode,
  isOfframpSupported,
} from "@features/payments/services/switchService";
import crypto from "crypto";
import { processUserQuery } from "@src/ai-agent/agent.config";
import { sendOrEdit } from "@src/shared/utils/messageHelper";

const AI_INTENT_KEYWORDS = ["send", "withdraw", "transfer", "pay", "buy", "balance", "deposit"];

/**
 * Handle potential withdrawal request from user using AI
 */
export async function handleAIQuery(ctx: Context): Promise<void> {
  try {
    const message = ctx.message as any;
    console.log("[AI Image Handler] Message received:", {
      hasText: !!message?.text,
      hasPhoto: !!message?.photo,
      hasCaption: !!message?.caption,
      photoCount: message?.photo?.length || 0
    });

    if (!message || (!message.text && !message.photo && !message.caption)) {
      console.log("[AI Image Handler] Message rejected - no text, photo, or caption");
      return;
    }

    const userMessage = message.text || message.caption || "";
    const userId = ctx.from?.id;

    if (userId) {
      const state = getAIWithdrawalState(userId);
      if (state && state.step === "awaiting_pin") {
        await handlePINInput(ctx);
        return;
      }
    }

    if (!userId) return;

    if (ctx.chat.type !== "private") {
      return;
    }

    const keywords = AI_INTENT_KEYWORDS;
    const hasWithdrawalKeyword = keywords.some(k => userMessage.toLowerCase().includes(k));
    const hasPhoto = !!message.photo;

    const currentState = getAIWithdrawalState(userId);
    const isProcessing = currentState?.step === "processing";

    console.log("[AI Image Handler] Intent check:", {
      hasWithdrawalKeyword,
      hasPhoto,
      isProcessing,
      keywords: keywords.slice(0, 5)
    });

    if (!isProcessing && !hasWithdrawalKeyword && !hasPhoto) {
      console.log("[AI Image Handler] Skipping - no active processing, keywords, or photo");
      return;
    }

    console.log("[AI Image Handler] Processing message - conditions met");

    let history: any[] = [];
    if (hasWithdrawalKeyword || hasPhoto) {
      clearAIWithdrawalState(userId);
      history = [];
    } else if (isProcessing && currentState?.data?.history) {
      history = currentState.data.history;
    }

    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
    await getUser(userId, username);

    let finalMessage: string | any[] = userMessage;

    if (hasPhoto) {
      console.log("[AI Image Handler] Photo detected - starting processing");
      await ctx.sendChatAction("upload_photo");

      const photo = message.photo[message.photo.length - 1];
      const fileId = photo.file_id;
      console.log("[AI Image Handler] Photo file ID:", fileId);

      try {
        const fileLink = await ctx.telegram.getFileLink(fileId);
        console.log("[AI Image Handler] Got file link:", fileLink.toString());

        const response = await fetch(fileLink.toString());
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString("base64");
        console.log("[AI Image Handler] Image downloaded and converted to base64, size:", base64Image.length, "chars");

        finalMessage = [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: base64Image,
            },
          },
          {
            type: "text",
            text: userMessage || "Please extract the withdrawal details from this image.",
          }
        ];
        console.log("[AI Image Handler] Multimodal message constructed with", finalMessage.length, "blocks");
      } catch (err) {
        console.error("[AI Image Handler] Error processing photo:", err);
        return;
      }
    }

    console.log("[AI Image Handler] Calling processUserQuery with message type:", Array.isArray(finalMessage) ? 'multimodal' : 'text');
    const aiResponse = await processUserQuery(userId, finalMessage, history);
    console.log("[AI Image Handler] AI Response type:", aiResponse.type);

    if (aiResponse.type === "error") {
      console.error(`[AI Withdrawal] AI Error: ${aiResponse.message} ${aiResponse?.data} ${aiResponse?.type}`);
      return;
    }

    if (aiResponse.type === "text") {
      if (aiResponse.updatedHistory) {
        setAIWithdrawalState(userId, "processing", {
          history: aiResponse.updatedHistory,
          ...currentState?.data
        });
      }

      await ctx.reply(aiResponse.message || "Please check your details.", {
        parse_mode: "Markdown"
      });
    }

    if (aiResponse.type === "confirmation") {
      const data = aiResponse.data;

      console.log("[AI Withdrawal] AI confirmed withdrawal details:", data);

      await initiatePINFlow(ctx, {
        amount: data.amount,
        amount_currency: data.amount_currency,
        recipient: data.account_number,
        bankName: data.bank_name,
        accountName: data.account_name,
        chain: data.chain,
        currency: data.currency,
        wallet_address: data.wallet_address,
      });
    }

    if (aiResponse.type === "bulk_confirmation") {
      const data = aiResponse.data;
      console.log("[AI Withdrawal] AI confirmed bulk withdrawal:", data);

      await initiateBulkPINFlow(ctx, {
        recipients: data.recipients,
        chain: data.chain,
        currency: data.currency,
      });
    }

  } catch (error: any) {
    console.error("[AI Withdrawal] Error in handleAIQuery:", error);
  }
}

/**
 * Sets up state for PIN entry and prompts user for PIN
 */
async function initiatePINFlow(ctx: Context, data: any): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  let cryptoAmount = 0;

  if (data.amount_currency && data.amount_currency !== 'NGN') {
    console.log(`[AI Withdrawal] Amount specified in Native Crypto: ${data.amount} ${data.amount_currency}`);
    cryptoAmount = data.amount;
  } else {
    console.log(`[AI Withdrawal] Amount specified in NGN: ${data.amount}`);
    cryptoAmount = await convertNGNToCrypto(
      data.amount,
      data.currency,
      data.chain
    );
  }

  let bankCode = null;
  if (!data.wallet_address) {
    const bName = data.bankName || data.bank_name;
    if (bName) {
      bankCode = findSwitchBankCode(bName);
    } else {
      console.warn("[AI Withdrawal] Missing bank name in bank flow. Skipping code lookup.");
    }
  }

  setAIWithdrawalState(userId, "awaiting_pin", {
    ...data,
    bankCode: bankCode,
    cryptoAmount,
    pinAttempts: 0
  });

  let confirmationMessage = "";

  if (data.wallet_address) {
    confirmationMessage =
      `*Please enter your 4-digit PIN to confirm Crypto Transfer:*\n\n` +
      `Amount: *${cryptoAmount} ${data.currency}*\n` +
      `Chain: *${data.chain}*\n` +
      `To Wallet: \`${data.wallet_address}\`\n`;

  } else {
    confirmationMessage =
      `*Please enter your 4-digit PIN to confirm Bank Withdrawal:*\n\n` +
      `Amount: *₦${data.amount.toLocaleString()}* (${cryptoAmount} ${data.currency})\n` +
      `Chain: *${data.chain}*\n` +
      `To: *${data.accountName || data.account_name}*\n` +
      `Bank: *${data.bankName || data.bank_name}*\n` +
      `Account: \`${data.account_number || data.recipient || data.accountnumber}\`\n`;
  }

  await ctx.reply(confirmationMessage, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("❌ Cancel", "ai_withdraw_cancel")]
    ])
  });
}

/**
 * Sets up state for bulk transfer PIN entry
 */
async function initiateBulkPINFlow(ctx: Context, data: any): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  setAIWithdrawalState(userId, "awaiting_bulk_pin", {
    recipients: data.recipients,
    chain: data.chain,
    currency: data.currency,
    pinAttempts: 0
  });

  let recipientList = "";
  let totalNGN = 0;

  for (let i = 0; i < data.recipients.length; i++) {
    const recipient = data.recipients[i];
    const amount = recipient.amount;
    let destination = "";

    if (recipient.wallet_address) {
      destination = `${recipient.wallet_address.slice(0, 6)}...${recipient.wallet_address.slice(-4)}`;
    } else {
      destination = `${recipient.account_name} (${recipient.bank_name})`;
    }

    recipientList += `${i + 1}. ${destination} - *${amount.toLocaleString()} ${recipient.amount_currency}*\n`;

    if (recipient.amount_currency === 'NGN') {
      totalNGN += amount;
    }
  }

  const confirmationMessage =
    `*Please enter your 4-digit PIN to confirm Bulk Transfer:*\n\n` +
    `Recipients (${data.recipients.length}):\n${recipientList}\n` +
    `Chain: *${data.chain}*\n` +
    `Currency: *${data.currency}*\n`;

  await ctx.reply(confirmationMessage, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("❌ Cancel", "ai_withdraw_cancel")]
    ])
  });
}

/**
 * Handle withdrawal cancellation
 */
export async function handleWithdrawalCancellation(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  clearAIWithdrawalState(userId);
  await ctx.answerCbQuery("❌ Withdrawal cancelled");

  try {
    await ctx.deleteMessage();
  } catch (e) {
    // Ignore
  }

  await ctx.reply("Withdrawal cancelled.");
}

/**
 * Handle PIN input and execute withdrawal
 */
export async function handlePINInput(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
  const message = (ctx.message as any)?.text;

  if (!userId || !message) {
    return;
  }

  const state = getAIWithdrawalState(userId);
  if (!state || (state.step !== "awaiting_pin" && state.step !== "awaiting_bulk_pin")) {
    return;
  }

  const enteredPin = message.trim();

  if (!/^\d{4}$/.test(enteredPin)) {
    await ctx.reply(
      "❌ Invalid PIN format. Please enter a 4-digit numeric PIN."
    );
    return;
  }

  const user = await getUser(userId, username);
  if (!user) {
    await ctx.reply("❌ User does not exist.");
    clearAIWithdrawalState(userId);
    return;
  }

  if (user.bank_details.withdrawalPin !== parseInt(enteredPin, 10)) {
    try {
      await ctx.deleteMessage();
    } catch (e) {
      // Ignore
    }

    const currentAttempts = (state.data.pinAttempts || 0) + 1;

    if (currentAttempts >= 2) {
      clearAIWithdrawalState(userId);
      await ctx.reply(
        "❌ *Withdrawal Cancelled*\n\n" +
        "You have entered an incorrect PIN twice. For security reasons, this withdrawal has been cancelled.\n\n" +
        "Please start a new withdrawal request.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    updateAIWithdrawalState(userId, { pinAttempts: currentAttempts });

    await ctx.reply(
      `❌ Incorrect withdrawal PIN. You have ${2 - currentAttempts
      } attempt(s) remaining.\n\n` +
      `Please enter your 4-digit withdrawal PIN:`
    );
    return;
  }

  try {
    await ctx.deleteMessage();
  } catch (e) {
    // Ignore
  }

  console.log(
    `[AI Withdrawal] PIN verified for user ${userId}, executing withdrawal`
  );

  if (state.step === "awaiting_bulk_pin") {
    await executeBulkWithdrawal(ctx, state.data, user);
  } else {
    await executeWithdrawal(ctx, state.data, user);
  }
}

/**
 * Execute single transfer without messaging
 */
async function executeSingleTransferSilent(
  ctx: Context,
  data: any,
  user: any
): Promise<{ success: boolean, error?: string, transactionId?: string, recipient: string }> {
  const userId = ctx.from?.id;
  if (!userId) {
    return { success: false, error: "No user ID", recipient: "unknown" };
  }

  try {
    let recipientAddress = "";
    let recipientName = data.wallet_address || `${data.accountName || data.account_name}`;
    let switchReference: string | undefined;

    if (data.wallet_address) {
      console.log(`[Silent Transfer] Crypto transfer to ${data.wallet_address}`);
      recipientAddress = data.wallet_address;
    } else {
      console.log(`[Silent Transfer] Bank transfer via Switch API: ${JSON.stringify(data)}`);

      const bankName = data.bankName || data.bank_name;
      const switchBankCode = findSwitchBankCode(bankName);

      if (!switchBankCode) {
        console.log(`[Silent Transfer] Bank "${bankName}" not supported`);
        return { success: false, error: `Bank "${bankName}" not supported`, recipient: recipientName };
      }

      if (!isOfframpSupported(data.currency)) {
        return {
          success: false,
          error: `Bank withdrawals only support stablecoins (USDC or USDT). Cannot withdraw ${data.currency} directly to a bank account.`,
          recipient: recipientName
        };
      }

      const recipientNumber = data.recipient || data.account_number;
      const reference = crypto.randomUUID();
      const assetCode = formatAssetCode(data.chain, data.currency);

      const offrampRes = await initiateOfframp({
        amount: Number(data.cryptoAmount),
        country: "NG",
        asset: assetCode,
        currency: "NGN",
        beneficiary: {
          holder_type: "INDIVIDUAL",
          holder_name: user.username || "User",
          account_number: recipientNumber,
          bank_code: switchBankCode,
        },
        sender_name: "Jumpa",
        reference,
      });

      if (!offrampRes.success || !offrampRes.data?.deposit?.address) {
        console.error("[Silent Transfer] Switch offramp error:", offrampRes);
        return {
          success: false,
          error: offrampRes.message || "Failed to initiate Switch offramp transaction",
          recipient: recipientName
        };
      }

      recipientAddress = offrampRes.data.deposit.address;
      switchReference = offrampRes.data.reference || reference;

      await Withdrawal.create({
        telegram_id: userId,
        transaction_id: offrampRes.data.reference || reference,
        fiatPayoutAmount: offrampRes.data.destination?.amount || 0,
        depositAmount: Number(data.cryptoAmount),
        yaraWalletAddress: recipientAddress,
        status: offrampRes.data.status || "AWAITING_DEPOSIT",
        batch_id: data.batch_id,
      });
    }

    let initTx;
    const depositAmount = Number(data.cryptoAmount);

    if (data.chain === "SOLANA") {
      if (data.currency === "SOL") {
        initTx = await executeSolTransfer(user, recipientAddress, depositAmount);
      } else if (data.currency === "USDC") {
        initTx = await executeUSDCTransfer(user, recipientAddress, depositAmount);
      } else if (data.currency === "USDT") {
        initTx = await executeUSDTTransfer(user, recipientAddress, depositAmount);
      }
    } else if (data.chain === "BASE" || data.chain === "CELO") {
      if (data.currency === "ETH") {
        initTx = await executeETHTransfer(user, recipientAddress, depositAmount, data.chain);
      } else if (data.currency === "USDC") {
        initTx = await executeUSDCTransferEVM(user, recipientAddress, depositAmount, data.chain);
      } else if (data.currency === "USDT") {
        initTx = await executeUSDTTransferEVM(user, recipientAddress, depositAmount, data.chain);
      } else if (data.currency === "CELO" && data.chain === "CELO") {
        initTx = await executeCELOTransfer(user, recipientAddress, depositAmount);
      }
    }

    if (initTx?.success) {
      const txHash = initTx.signature || initTx.hash || "";

      // Confirm offramp deposit with Switch API if this was a bank withdrawal
      if (!data.wallet_address && switchReference && txHash) {
        try {
          await confirmDeposit(switchReference, txHash);
          console.log(`[AI Withdrawal] Offramp deposit confirmed with Switch. Ref: ${switchReference}, Hash: ${txHash}`);
        } catch (confirmErr: any) {
          console.warn(`[AI Withdrawal] Failed to confirm deposit with Switch:`, confirmErr?.message || confirmErr);
        }
      }

      return {
        success: true,
        transactionId: txHash,
        recipient: recipientName
      };
    } else {
      return {
        success: false,
        error: initTx?.error || "Transfer failed",
        recipient: recipientName
      };
    }

  } catch (error: any) {
    console.error("[Silent Transfer] Error:", error);
    return {
      success: false,
      error: "Failed to process transaction. Please retry in a few minutes or contact support.",
      recipient: data.accountName || data.wallet_address || "unknown"
    };
  }
}

/**
 * Execute actual single withdrawal transaction
 */
async function executeWithdrawal(
  ctx: Context,
  data: any,
  user: any
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    await sendOrEdit(ctx, "Processing withdrawal...");

    const result = await executeSingleTransferSilent(ctx, data, user);

    if (result.success) {
      let successMsg = "";

      if (data.wallet_address) {
        successMsg = `✅ **Withdrawal Successful!**\n\n` +
          `Sent: \`${Number(data.cryptoAmount)} ${data.currency}\`\n` +
          `To: \`${data.wallet_address}\`\n` +
          `Chain: ${data.chain}`;
      } else {
        successMsg = `✅ **Withdrawal Initiated!**\n\n` +
          `Sent: ${Number(data.cryptoAmount)} ${data.currency}\n` +
          `To: ${data.accountName || data.account_name}\n` +
          `Account credited shortly.`;
      }

      await sendOrEdit(ctx, successMsg, { parse_mode: "Markdown" });
    } else {
      await sendOrEdit(ctx, `❌ Withdrawal failed: ${result.error || "Unknown error"}`);
    }

    clearAIWithdrawalState(userId);
  } catch (error: any) {
    console.error("[AI Withdrawal] Execution error:", error);
    await ctx.reply(`❌ Withdrawal failed: ${error.message}`);
    clearAIWithdrawalState(userId);
  }
}

/**
 * Execute bulk withdrawal
 */
async function executeBulkWithdrawal(
  ctx: Context,
  data: any,
  user: any
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const { recipients, chain, currency } = data;
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const results: Array<{ index: number, success: boolean, error?: string, recipient: string }> = [];

  try {
    await ctx.reply(`🔄 Processing ${recipients.length} transfers...`);

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      console.log(`[Bulk Withdrawal] Processing ${i + 1}/${recipients.length}`);

      let cryptoAmount = recipient.amount;
      if (recipient.amount_currency === 'NGN') {
        try {
          cryptoAmount = await convertNGNToCrypto(recipient.amount, currency, chain);
          console.log(`[Bulk Withdrawal] Converted ${recipient.amount} NGN to ${cryptoAmount} ${currency}`);
        } catch (e: any) {
          console.error(`[Bulk Withdrawal] Conversion failed for recipient ${i + 1}:`, e);
          results.push({
            index: i + 1,
            success: false,
            error: `Currency conversion failed: ${e.message}`,
            recipient: recipient.account_name || recipient.wallet_address || "Unknown"
          });
          continue;
        }
      }

      const transferData = {
        amount: recipient.amount,
        amount_currency: recipient.amount_currency,
        account_number: recipient.account_number,
        bank_name: recipient.bank_name,
        accountName: recipient.account_name,
        wallet_address: recipient.wallet_address,
        chain,
        currency,
        cryptoAmount: cryptoAmount,
        batch_id: batchId,
      };

      const result = await executeSingleTransferSilent(ctx, transferData, user);

      results.push({
        index: i + 1,
        success: result.success,
        error: result.error,
        recipient: result.recipient
      });

      console.log(`[Bulk Withdrawal] ${i + 1}/${recipients.length}: ${result.success ? 'Success' : 'Failed'}`);

      if (i < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const summary = formatBulkSummary(results, recipients);
    await ctx.reply(summary, { parse_mode: "Markdown" });

    clearAIWithdrawalState(userId);

  } catch (error: any) {
    console.error("[Bulk Withdrawal] Fatal error:", error);
    await ctx.reply(`❌ Bulk withdrawal failed: ${error.message}`);
    clearAIWithdrawalState(userId);
  }
}

/**
 * Format bulk transfer summary
 */
function formatBulkSummary(results: any[], recipients: any[]): string {
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  let summary = `\n📊 **Bulk Transfer Complete**\n\n`;
  summary += `Total: ${results.length} | ✅ Success: ${successCount} | ❌ Failed: ${failureCount}\n\n`;

  for (const result of results) {
    const recipient = recipients[result.index - 1];
    const amount = recipient.amount;
    const currency = recipient.amount_currency;

    if (result.success) {
      summary += `${result.index}. ✅ ${result.recipient} - ${amount} ${currency}\n\n`;
    } else {
      summary += `${result.index}. ❌ ${result.recipient} - Failed: ${result.error}\n\n`;
    }
  }

  return summary;
}
