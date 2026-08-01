import { Markup } from "telegraf";
import { InlineKeyboardMarkup } from "telegraf/types";

/**
 * Build keyboard for private chat context
 * Shows full menu with wallet, profile, and transaction options
 */
export function buildPrivateChatKeyboard(): {
  reply_markup: InlineKeyboardMarkup;
} {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(" Manage Wallets", "view_wallet"),
      Markup.button.callback(" My Profile", "view_profile"),
    ],
    [
      Markup.button.callback("Withdraw", "withdraw_sol"),
      Markup.button.callback("Referral", "referral")
    ],
    [
      Markup.button.callback(" Help & Commands", "show_help"),
      Markup.button.callback(" About Jumpa", "show_about"),
    ],
    [Markup.button.callback("🔄 Refresh", "refresh_balances")],
  ]);
}



/**
 * Build keyboard for wallet setup (when user has no wallets)
 */
export function buildWalletSetupKeyboard(): {
  reply_markup: InlineKeyboardMarkup;
} {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(" Generate Solana Wallet", "generate_wallet"),
      Markup.button.callback(" Import Solana Wallet", "import_wallet"),
    ],
    [
      Markup.button.callback("Generate EVM Wallet", "generate_evm_wallet"),
      Markup.button.callback("Import EVM Wallet", "add_wallet_evm"),
    ],
  ]);
}
