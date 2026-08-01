import { Telegraf, Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { StartCommand } from "@features/onboarding/commands/StartCommand";
import { HelpCommand } from "@features/onboarding/commands/HelpCommand";
import { WalletCommand } from "@features/wallets/commands/WalletCommand";
import { getBankUpdateState } from "@shared/state/bankState";
import { WalletCallbackHandlers } from "@features/wallets/callbacks/WalletCallbackHandlers";
import { StartCallbackHandlers } from "@features/onboarding/callbacks/StartCallbackHandlers";
import { DepositCommand } from "@features/payments/commands/DepositCommand";
import { DepositCallbacks } from "@features/payments/callbacks/DepositCallbacks";
import { BankHandler } from "@features/payments/commands/BankHandler";
import {
  getWithdrawalState,
  clearWithdrawalState,
} from "@shared/state/withdrawalState";
import { getAIWithdrawalState } from "@shared/state/aiWithdrawalState";
import { getDepositState } from "@shared/state/depositState";
import { handleDetectToken } from "@features/trading/utils/DetectTokenAddress";
import { handleBuy } from "@features/trading/commands/BuyCommand";
import { BuyCallbackHandlers } from "@features/trading/callbacks/BuyCallbackHandlers";
import { handleSell } from "@features/trading/commands/SellCommand";
import { SellCallbackHandlers } from "@features/trading/callbacks/SellCallbackHandlers";
import { handleBuyCustomAmountRequest } from "@features/trading/callbacks/CustomAmountCallbackHandler";
import {
  getUserActionState,
  clearUserActionState,
} from "@shared/state/userActionState";
import { createBuyOrder } from "@features/trading/utils/createBuyOrder";
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
import { ReferralCommand } from "@features/referrals/commands/ReferralCommand";
import { ImageTestCommand } from "@features/onboarding/commands/ImageTestCommand";
import { AICallbackHandler } from "@features/payments/callbacks/AIAgentCallback";
import { ProfitAndLossTestCommand } from "@features/onboarding/commands/ProfitAndLossTestCommand";

export class CommandManager {
  private commands: Map<string, BaseCommand> = new Map();
  private bot: Telegraf<Context>;

  constructor(bot: Telegraf<Context>) {
    this.bot = bot;
    this.registerCommands();
    this.setupCommandHandlers();
    this.updateBotCommands();
  }

  private registerCommands(): void {
    const commandInstances = [
      new StartCommand(),
      new HelpCommand(),
      new WalletCommand(),
      new ReferralCommand(),
      new ImageTestCommand(),
      new ProfitAndLossTestCommand(),
      new DepositCommand(),
    ];

    commandInstances.forEach((command) => {
      this.commands.set(command.name, command);
    });
  }

  private setupCommandHandlers(): void {
    // Register each command with the bot
    this.commands.forEach((command, commandName) => {
      this.bot.command(commandName, async (ctx: Context) => {
        try {
          await command.execute(ctx);
        } catch (error) {
          console.error(`Error executing command ${commandName}:`, error);
          await ctx.reply("Sorry, something went wrong with that command!");
        }
      });
    });

    // Register callback handlers for start command
    this.bot.action("view_wallet", StartCallbackHandlers.handleViewWallet);
    this.bot.action("view_profile", StartCallbackHandlers.handleViewProfile);
    this.bot.action("show_help", StartCallbackHandlers.handleShowHelp);
    this.bot.action("show_about", StartCallbackHandlers.handleShowAbout);
    this.bot.action("back_to_menu", StartCallbackHandlers.handleBackToMenu);
    this.bot.action("refresh_balances", StartCallbackHandlers.handleRefreshBalances);
    this.bot.action(
      "generate_wallet",
      StartCallbackHandlers.handleGenerateWallet
    );
    this.bot.action("import_wallet", StartCallbackHandlers.handleImportWallet);
    this.bot.action("add_wallet", StartCallbackHandlers.handleAddWallet);
    this.bot.action(
      "add_wallet_solana",
      StartCallbackHandlers.handleAddSolanaWallet
    );
    this.bot.action("add_wallet_evm", StartCallbackHandlers.handleAddEVMWallet);
    this.bot.action(
      "generate_evm_wallet",
      StartCallbackHandlers.handleGenerateEVMWallet
    );
    this.bot.action(
      /set_default_solana:/,
      StartCallbackHandlers.handleSetDefaultSolanaWallet
    );
    this.bot.action(
      /set_default_evm:/,
      StartCallbackHandlers.handleSetDefaultEVMWallet
    );
    this.bot.action(
      /delete_solana_wallet:/,
      StartCallbackHandlers.handleDeleteSolanaWallet
    );
    this.bot.action(
      /delete_evm_wallet:/,
      StartCallbackHandlers.handleDeleteEVMWallet
    );
    this.bot.action(
      /confirm_delete_solana:/,
      StartCallbackHandlers.handleDeleteSolanaWallet
    );
    this.bot.action(
      /confirm_delete_evm:/,
      StartCallbackHandlers.handleDeleteEVMWallet
    );

    // Register deposit callback handlers
    this.bot.action("deposit_from_bank", DepositCallbacks.handleFromBank);
    this.bot.action(/^deposit_select_asset:/, DepositCallbacks.handleAssetSelection);
    this.bot.action("deposit_confirm", DepositCallbacks.handleConfirmation);

    // Register referral callback handler
    this.bot.action("referral", async (ctx) => {
      const referralCommand = this.commands.get("referral");
      if (referralCommand) {
        await referralCommand.execute(ctx);
      }
    });

    // Register callback handlers for exporting private key
    this.bot.action("export_private_key", handleExportPrivateKey);
    this.bot.action("show_private_key", handleExportPrivateKey); // Alias from /wallet command
    this.bot.action(
      /^select_export_(sol|evm):\d+$/,
      handleSelectWalletForExport
    );
    this.bot.action("cancel_export", handleCancelExport);

    // Register callback handlers for wallet command
    this.bot.action("withdraw_sol", WalletCallbackHandlers.handleWithdraw);
    this.bot.action(
      "withdraw_to_bank",
      WalletCallbackHandlers.handleWithdrawToBank
    );
    this.bot.action(
      "refresh_balance",
      WalletCallbackHandlers.handleRefreshBalance
    );
    this.bot.action(
      /^withdraw_currency:(?!.*ai_)/,
      WalletCallbackHandlers.handleWithdrawCurrencySelection
    );
    this.bot.action(
      /^withdraw_custom_amount:/,
      WalletCallbackHandlers.handleWithdrawCustomAmount
    );
    this.bot.action(
      /^withdraw_amount:/,
      WalletCallbackHandlers.handleWithdrawAmount
    );
    this.bot.action(
      /^withdraw_confirm:/,
      WalletCallbackHandlers.handleWithdrawConfirmation
    );

    this.bot.action(
      "withdraw_onchain",
      WalletCallbackHandlers.handleWithdrawOnChain
    );
    this.bot.action(
      /^withdraw_onchain_asset:/,
      WalletCallbackHandlers.handleWithdrawOnChainAsset
    );
    this.bot.action(
      /^withdraw_onchain_amount:/,
      WalletCallbackHandlers.handleWithdrawOnChainAmountSelection
    );

    this.bot.action(
      "ai_withdraw_cancel",
      AICallbackHandler.handleWithdrawalCancellation
    );

    // Register delete message action (reusable for any command)
    this.bot.action("delete_message", async (ctx) => {
      try {
        await ctx.deleteMessage();
        await ctx.answerCbQuery("Cancelled");
      } catch (error) {
        console.error("Error deleting message:", error);
        await ctx.answerCbQuery("Message deleted");
      }
    });

    // Register close_wallet as alias for delete_message
    this.bot.action("close_wallet", async (ctx) => {
      try {
        await ctx.deleteMessage();
        await ctx.answerCbQuery("Closed");
      } catch (error) {
        console.error("Error deleting message:", error);
        await ctx.answerCbQuery("Message closed");
      }
    });

    // Register wallet_details to show full wallet view
    this.bot.action("wallet_details", StartCallbackHandlers.handleViewWallet);

    //register buy and sell commands
    this.bot.action(/^buy:.+/, handleBuy);
    this.bot.action(/^approve_buy:.+/, BuyCallbackHandlers.handleApprove);
    this.bot.action("decline_buy", BuyCallbackHandlers.handleDecline);
    this.bot.action(/^buy_custom:.+/, handleBuyCustomAmountRequest);
    this.bot.action(/^refresh:.+/, handleRefresh);

    this.bot.action(/^sell:.+/, handleSell);
    this.bot.action(/^approve_sell:.+/, SellCallbackHandlers.handleApprove);
    this.bot.action("decline_sell", SellCallbackHandlers.handleDecline);

    // Register token carousel handlers
    this.bot.action("manage_tokens", handleManageTokens);
    this.bot.action(/^carousel_nav:.+/, handleCarouselNavigate);

    //register callback handlers for bank account
    this.bot.action("view_bank_account", BankHandler.getBankAccount);
    this.bot.action("update_bank_name", BankHandler.updateBankName);

    this.bot.action(
      /update_bank_name:confirm:/,
      BankHandler.handleBankNameConfirmation
    );
    this.bot.action(
      "update_bank_name:cancel",
      BankHandler.handleBankNameConfirmation
    );

    this.bot.action(
      "final_confirmation:confirm",
      BankHandler.handleFinalConfirmation
    );
    this.bot.action(
      "final_confirmation:cancel",
      BankHandler.handleFinalConfirmation
    );
    //withdrawal pin handler
    this.bot.action("set_withdrawal_pin", BankHandler.handleSetWithdrawalPin);
    this.bot.action(
      /set_withdrawal_pin:confirm:/,
      BankHandler.handleSetWithdrawalPinConfirmation
    );
    this.bot.action(
      "set_withdrawal_pin:cancel",
      BankHandler.handleSetWithdrawalPinConfirmation
    );

    this.bot.on("text", async (ctx) => {
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
        // Clear the state
        clearUserActionState(userId);
        // Create the buy order
        await createBuyOrder(ctx, userAction.tradeId, amount);
        return; // Stop further processing
      }

      // Handle pin for private key export
      if (userAction?.action === "awaiting_export_pin") {
        await handlePinForExport(ctx);
        return;
      }

      // Handle private key import
      if (userAction?.action === "awaiting_import_private_key") {
        // Check if user wants to cancel
        if (text.toLowerCase().trim() === "/cancel") {
          clearUserActionState(userId);
          await ctx.reply("❌ Wallet import cancelled.");
          return;
        }
        await StartCallbackHandlers.handlePrivateKeyImport(ctx, text);
        return;
      }

      // Handle add Solana private key input
      if (userAction?.action === "awaiting_add_solana_private_key") {
        // Check if user wants to cancel
        if (text.toLowerCase().trim() === "/cancel") {
          clearUserActionState(userId);
          await ctx.reply("❌ Add wallet cancelled.");
          return;
        }
        await StartCallbackHandlers.handleAddSolanaPrivateKeyInput(ctx, text);
        return;
      }

      // Handle add EVM private key input
      if (userAction?.action === "awaiting_add_evm_private_key") {
        // Check if user wants to cancel
        if (text.toLowerCase().trim() === "/cancel") {
          clearUserActionState(userId);
          await ctx.reply("❌ Add wallet cancelled.");
          return;
        }
        await StartCallbackHandlers.handleAddEVMPrivateKeyInput(ctx, text);
        return;
      }

      const state = getBankUpdateState(userId);
      const withdrawalState = getWithdrawalState(userId);
      if (withdrawalState) {
        if (withdrawalState.step === "awaiting_custom_amount") {
          await WalletCallbackHandlers.handleCustomAmountInput(ctx);
          return;
        } else if (withdrawalState.step === "awaiting_pin") {
          await WalletCallbackHandlers.handleWithdrawPinVerification(ctx);
          return;
        } else if (withdrawalState.step === "awaiting_dest_address") {
          await WalletCallbackHandlers.handleWithdrawAddressInput(ctx);
          return;
        } else if (withdrawalState.step === "awaiting_onchain_amount") {
          await WalletCallbackHandlers.handleWithdrawOnChainAmountInput(ctx);
          return;
        } else if (withdrawalState.step === "awaiting_onchain_pin") {
          await WalletCallbackHandlers.handleWithdrawOnChainPinVerification(ctx);
          return;
        }
      }

      if (state) {
        if (state.step === "awaiting_bank_name") {
          await BankHandler.handleBankNameSelection(ctx);
        } else {
          await BankHandler.handleBankUpdate(ctx);
        }
        return;
      }
      // Handle AI withdrawal PIN input
      const aiWithdrawalState = getAIWithdrawalState(userId);
      if (aiWithdrawalState?.step === "awaiting_pin" || aiWithdrawalState?.step === "awaiting_bulk_pin") {
        await AICallbackHandler.handlePINInput(ctx);
        return;
      }

      // Detect if a solana address is sent
      const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

      if (solanaAddressRegex.test(text)) {
        console.log("Detected potential Solana contract address:", text);
        await handleDetectToken(ctx, text);
        return;
      }

      // Handle Deposit amount input
      const depositState = getDepositState(userId);
      if (depositState?.step === "awaiting_amount") {
        await DepositCallbacks.handleAmountInput(ctx);
        return;
      }

      console.log("Checking for withdrawal intent:", text);
      await AICallbackHandler.handleAIQuery(ctx);
    });

    // Handle photo messages (for AI processing)
    this.bot.on("photo", async (ctx) => {
      console.log("Received photo message");
      await AICallbackHandler.handleAIQuery(ctx);
    });
  }

  public async updateBotCommands(): Promise<void> {
    try {
      // Define commands for private chats (user-focused)
      const privateCommands = [
        { command: "start", description: "Start the bot" },
        { command: "help", description: "Get help" },
        { command: "wallet", description: "Manage your wallet" },
        { command: "referral", description: "View referral info" },
        { command: "deposit", description: "Deposit funds" },
      ];

      // Set commands for private chats
      await this.bot.telegram.setMyCommands(privateCommands, {
        scope: { type: "all_private_chats" },
      });

      console.log("✅ Bot commands updated for all scopes:");
      console.log(`  - Private chats: ${privateCommands.length} commands`);
    } catch (error) {
      console.error("❌ Failed to update bot commands:", error);
    }
  }

  public getCommand(name: string): BaseCommand | undefined {
    return this.commands.get(name);
  }

  public getAllCommands(): BaseCommand[] {
    return Array.from(this.commands.values());
  }

  public getCommandNames(): string[] {
    return Array.from(this.commands.keys());
  }
}
