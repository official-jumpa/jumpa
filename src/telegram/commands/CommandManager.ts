import { Telegraf, Context } from "telegraf";
import { handleStartCommand, startCommandConfig } from "@features/onboarding/commands/StartCommand";
import { handleHelpCommand, helpCommandConfig } from "@features/onboarding/commands/HelpCommand";
import { handleImageTestCommand, imageTestCommandConfig } from "@features/onboarding/commands/ImageTestCommand";
import { handleProfitAndLossTestCommand, pnlTestCommandConfig } from "@features/onboarding/commands/ProfitAndLossTestCommand";
import { handleWalletCommand, walletCommandConfig } from "@features/wallets/commands/WalletCommand";
import {
  getBankUpdateState,
  getWithdrawalState,
  clearWithdrawalState,
  getAIWithdrawalState,
  getDepositState,
  getUserActionState,
  clearUserActionState,
} from "@shared/state";
import { createBuyOrder } from "@features/trading/utils/createBuyOrder";
import {
  handleWithdraw,
  handleWithdrawToBank,
  handleWithdrawCurrencySelection,
  handleWithdrawCustomAmount,
  handleCustomAmountInput,
  handleWithdrawAmount,
  handleWithdrawConfirmation,
  handleWithdrawPinVerification,
  handleWithdrawOnChain,
  handleWithdrawOnChainAsset,
  handleWithdrawAddressInput,
  handleWithdrawOnChainAmountSelection,
  handleWithdrawOnChainAmountInput,
  handleWithdrawOnChainPinVerification,
  handleRefreshBalance,
} from "@features/wallets/callbacks/WalletCallbackHandlers";
import {
  handleViewWallet,
  handleWalletTabSwitch,
  handleViewProfile,
  handleShowHelp,
  handleShowAbout,
  handleBackToMenu,
  handleRefreshBalances,
  handleGenerateWallet,
  handleImportWallet,
  handleAddWallet,
  handleAddSolanaWallet,
  handleAddEVMWallet,
  handleGenerateEVMWallet,
  handleAddStellarWallet,
  handleGenerateStellarWallet,
  handleSetDefaultSolanaWallet,
  handleSetDefaultEVMWallet,
  handleSetDefaultStellarWallet,
  handleDeleteSolanaWallet,
  handleDeleteEVMWallet,
  handleDeleteStellarWallet,
  handlePrivateKeyImport,
  handleAddSolanaPrivateKeyInput,
  handleAddEVMPrivateKeyInput,
  handleAddStellarPrivateKeyInput,
} from "@features/onboarding/callbacks/StartCallbackHandlers";
import {
  handleFromBank as handleDepositFromBank,
  handleAssetSelection as handleDepositAssetSelection,
  handleAmountInput as handleDepositAmountInput,
  handleConfirmation as handleDepositConfirmation,
} from "@features/payments/callbacks/DepositCallbacks";
import {
  handleAIQuery,
  handleWithdrawalCancellation,
  handlePINInput as handleAIPINInput,
} from "@features/payments/callbacks/AIAgentCallback";
import { handleDepositCommand, depositCommandConfig } from "@features/payments/commands/DepositCommand";
import {
  handleGetBankAccount,
  handleUpdateBankName,
  handleFinalConfirmation,
  handleBankNameConfirmation,
  handleBankUpdate,
  handleBankNameSelection,
  handleSetWithdrawalPin,
  handleSetWithdrawalPinConfirmation,
} from "@features/payments/commands/BankHandler";
import { handleDetectToken } from "@features/trading/utils/DetectTokenAddress";
import { handleBuy } from "@features/trading/commands/BuyCommand";
import { handleSell } from "@features/trading/commands/SellCommand";
import { handleBuyCustomAmountRequest } from "@features/trading/callbacks/CustomAmountCallbackHandler";
import { handleRefresh } from "@telegram/callbacks/RefreshCallbackHandler";
import {
  handleManageTokens,
  handleCarouselNavigate
} from "@features/trading/callbacks/TokenCarouselHandler";
import {
  handleExportPrivateKey,
  handleSelectWalletForExport,
  handleCancelExport,
  handlePinForExport,
} from "@features/wallets/callbacks/ExportWalletCallbackHandler";
import { handleReferralCommand, referralCommandConfig } from "@features/referrals/commands/ReferralCommand";
import { handleApproveBuy, handleDeclineBuy } from "@features/trading/callbacks/BuyCallbackHandlers";
import { handleApproveSell, handleDeclineSell } from "@features/trading/callbacks/SellCallbackHandlers";

/**
 * Registration of bot commands, callback actions, and event listeners
 */
export function setupCommandManager(bot: Telegraf<Context>): void {
  // Register functional commands
  bot.command(startCommandConfig.name, handleStartCommand);
  bot.command(helpCommandConfig.name, handleHelpCommand);
  bot.command(imageTestCommandConfig.name, handleImageTestCommand);
  bot.command(pnlTestCommandConfig.name, handleProfitAndLossTestCommand);
  bot.command(depositCommandConfig.name, handleDepositCommand);
  bot.command(walletCommandConfig.name, handleWalletCommand);
  bot.command(referralCommandConfig.name, handleReferralCommand);

  // Register callback handlers for start command
  bot.action("view_wallet", (ctx) => handleViewWallet(ctx));
  bot.action(/^wallet_tab:(solana|evm|stellar):(\d+)$/, handleWalletTabSwitch);
  bot.action("view_profile", handleViewProfile);
  bot.action("show_help", handleShowHelp);
  bot.action("show_about", handleShowAbout);
  bot.action("back_to_menu", handleBackToMenu);
  bot.action("refresh_balances", handleRefreshBalances);
  bot.action("generate_wallet", handleGenerateWallet);
  bot.action("import_wallet", handleImportWallet);
  bot.action("add_wallet", handleAddWallet);
  bot.action("add_wallet_solana", handleAddSolanaWallet);
  bot.action("add_wallet_evm", handleAddEVMWallet);
  bot.action("generate_evm_wallet", handleGenerateEVMWallet);
  bot.action("add_wallet_stellar", handleAddStellarWallet);
  bot.action("generate_stellar_wallet", handleGenerateStellarWallet);
  bot.action(/set_default_solana:/, handleSetDefaultSolanaWallet);
  bot.action(/set_default_evm:/, handleSetDefaultEVMWallet);
  bot.action(/set_default_stellar:/, handleSetDefaultStellarWallet);
  bot.action(/delete_solana_wallet:/, handleDeleteSolanaWallet);
  bot.action(/delete_evm_wallet:/, handleDeleteEVMWallet);
  bot.action(/delete_stellar_wallet:/, handleDeleteStellarWallet);
  bot.action(/confirm_delete_solana:/, handleDeleteSolanaWallet);
  bot.action(/confirm_delete_evm:/, handleDeleteEVMWallet);
  bot.action(/confirm_delete_stellar:/, handleDeleteStellarWallet);

  // Register deposit callback handlers
  bot.action("deposit_sol", handleDepositCommand);
  bot.action("deposit_from_bank", handleDepositFromBank);
  bot.action(/^deposit_select_asset:/, handleDepositAssetSelection);
  bot.action("deposit_confirm", handleDepositConfirmation);

  // Register referral callback handler
  bot.action("referral", handleReferralCommand);

  // Register buy and sell callback handlers
  bot.action(/^buy:.+/, handleBuy);
  bot.action(/^approve_buy:.+/, handleApproveBuy);
  bot.action("decline_buy", handleDeclineBuy);
  bot.action(/^buy_custom:.+/, handleBuyCustomAmountRequest);
  bot.action(/^refresh:.+/, handleRefresh);

  bot.action(/^sell:.+/, handleSell);
  bot.action(/^approve_sell:.+/, handleApproveSell);
  bot.action("decline_sell", handleDeclineSell);

  // Register callback handlers for exporting private key
  bot.action("export_private_key", handleExportPrivateKey);
  bot.action("show_private_key", handleExportPrivateKey);
  bot.action(
    /^select_export_(sol|evm|stellar):\d+$/,
    handleSelectWalletForExport
  );
  bot.action("cancel_export", handleCancelExport);
  bot.action(/^pin_export:.+$/, handlePinForExport);

  // Register callback handlers for wallet command
  bot.action("withdraw_sol", handleWithdraw);
  bot.action("withdraw_to_bank", handleWithdrawToBank);
  bot.action(/^refresh_wallet(?::(solana|evm|stellar):(\d+))?$/, handleRefreshBalance);
  bot.action(
    /^withdraw_currency:(?!.*ai_)/,
    handleWithdrawCurrencySelection
  );
  bot.action(
    /^withdraw_custom_amount:/,
    handleWithdrawCustomAmount
  );
  bot.action(
    /^withdraw_amount:/,
    handleWithdrawAmount
  );
  bot.action(
    /^withdraw_confirm:/,
    handleWithdrawConfirmation
  );

  bot.action("withdraw_onchain", handleWithdrawOnChain);
  bot.action(
    /^withdraw_onchain_asset:/,
    handleWithdrawOnChainAsset
  );
  bot.action(
    /^withdraw_onchain_amount:/,
    handleWithdrawOnChainAmountSelection
  );

  bot.action("ai_withdraw_cancel", handleWithdrawalCancellation);

  // Register delete message action
  bot.action("delete_message", async (ctx) => {
    try {
      await ctx.deleteMessage();
      await ctx.answerCbQuery("Cancelled");
    } catch (error) {
      console.error("Error deleting message:", error);
      await ctx.answerCbQuery("Message deleted");
    }
  });

  bot.action("close_wallet", async (ctx) => {
    try {
      await ctx.deleteMessage();
      await ctx.answerCbQuery("Closed");
    } catch (error) {
      console.error("Error deleting message:", error);
      await ctx.answerCbQuery("Message closed");
    }
  });

  bot.action("wallet_details", (ctx) => handleViewWallet(ctx));

  // Register token carousel handlers
  bot.action("manage_tokens", handleManageTokens);
  bot.action(/^carousel_nav:.+/, handleCarouselNavigate);

  // Register callback handlers for bank account
  bot.action("view_bank_account", handleGetBankAccount);
  bot.action("update_bank_name", handleUpdateBankName);

  bot.action(
    /update_bank_name:confirm:/,
    handleBankNameConfirmation
  );
  bot.action(
    "update_bank_name:cancel",
    handleBankNameConfirmation
  );

  bot.action(
    "final_confirmation:confirm",
    handleFinalConfirmation
  );
  bot.action(
    "final_confirmation:cancel",
    handleFinalConfirmation
  );
  bot.action("set_withdrawal_pin", handleSetWithdrawalPin);
  bot.action(
    /set_withdrawal_pin:confirm:/,
    handleSetWithdrawalPinConfirmation
  );
  bot.action(
    "set_withdrawal_pin:cancel",
    handleSetWithdrawalPinConfirmation
  );

  // Text message listener
  bot.on("text", async (ctx) => {
    const text = ctx.message.text;
    console.log("Received text message:", text);
    const userId = ctx.from?.id;
    if (!userId) return;

    const userAction = getUserActionState(userId);
    if (userAction?.action === "awaiting_custom_buy_amount") {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply("Invalid amount. Please enter a positive number.");
        return;
      }
      clearUserActionState(userId);
      await createBuyOrder(ctx, userAction.tradeId, amount);
      return;
    }

    if (userAction?.action === "awaiting_export_pin") {
      await handlePinForExport(ctx);
      return;
    }

    if (userAction?.action === "awaiting_import_private_key") {
      if (text.toLowerCase().trim() === "/cancel") {
        clearUserActionState(userId);
        await ctx.reply("❌ Wallet import cancelled.");
        return;
      }
      await handlePrivateKeyImport(ctx, text);
      return;
    }

    if (userAction?.action === "awaiting_add_solana_private_key") {
      if (text.toLowerCase().trim() === "/cancel") {
        clearUserActionState(userId);
        await ctx.reply("❌ Add wallet cancelled.");
        return;
      }
      await handleAddSolanaPrivateKeyInput(ctx, text);
      return;
    }

    if (userAction?.action === "awaiting_add_evm_private_key") {
      if (text.toLowerCase().trim() === "/cancel") {
        clearUserActionState(userId);
        await ctx.reply("❌ Add wallet cancelled.");
        return;
      }
      await handleAddEVMPrivateKeyInput(ctx, text);
      return;
    }

    if (userAction?.action === "awaiting_add_stellar_private_key") {
      if (text.toLowerCase().trim() === "/cancel") {
        clearUserActionState(userId);
        await ctx.reply("❌ Add wallet cancelled");
        return;
      }
      await handleAddStellarPrivateKeyInput(ctx, text);
      return;
    }

    const state = getBankUpdateState(userId);
    const withdrawalState = getWithdrawalState(userId);
    if (withdrawalState) {
      if (withdrawalState.step === "awaiting_custom_amount") {
        await handleCustomAmountInput(ctx);
        return;
      } else if (withdrawalState.step === "awaiting_pin") {
        await handleWithdrawPinVerification(ctx);
        return;
      } else if (withdrawalState.step === "awaiting_dest_address") {
        await handleWithdrawAddressInput(ctx);
        return;
      } else if (withdrawalState.step === "awaiting_onchain_amount") {
        await handleWithdrawOnChainAmountInput(ctx);
        return;
      } else if (withdrawalState.step === "awaiting_onchain_pin") {
        await handleWithdrawOnChainPinVerification(ctx);
        return;
      }
    }

    if (state) {
      if (state.step === "awaiting_bank_name") {
        await handleBankNameSelection(ctx);
      } else {
        await handleBankUpdate(ctx);
      }
      return;
    }

    const aiWithdrawalState = getAIWithdrawalState(userId);
    if (aiWithdrawalState?.step === "awaiting_pin" || aiWithdrawalState?.step === "awaiting_bulk_pin") {
      await handleAIPINInput(ctx);
      return;
    }

    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

    if (solanaAddressRegex.test(text)) {
      console.log("Detected potential Solana contract address:", text);
      await handleDetectToken(ctx, text);
      return;
    }

    const depositState = getDepositState(userId);
    if (depositState?.step === "awaiting_amount") {
      await handleDepositAmountInput(ctx);
      return;
    }

    console.log("Checking for withdrawal intent:", text);
    await handleAIQuery(ctx);
  });

  // Photo message listener
  bot.on("photo", async (ctx) => {
    console.log("Received photo message");
    await handleAIQuery(ctx);
  });

  updateBotCommands(bot);
}

/**
 * Configure Telegram myCommands list for private chats
 */
export async function updateBotCommands(bot: Telegraf<Context>): Promise<void> {
  try {
    const privateCommands = [
      { command: startCommandConfig.name, description: startCommandConfig.description },
      { command: helpCommandConfig.name, description: helpCommandConfig.description },
      { command: walletCommandConfig.name, description: walletCommandConfig.description },
      { command: referralCommandConfig.name, description: referralCommandConfig.description },
      { command: depositCommandConfig.name, description: depositCommandConfig.description },
    ];

    await bot.telegram.setMyCommands(privateCommands, {
      scope: { type: "all_private_chats" },
    });

    console.log("✅ Bot commands updated for all scopes:");
    console.log(`  - Private chats: ${privateCommands.length} commands`);
  } catch (error) {
    console.error("❌ Failed to update bot commands:", error);
  }
}
