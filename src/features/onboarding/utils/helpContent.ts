import { Markup } from "telegraf";

/**
 * Centralized help content for the bot
 * Used by both HelpCommand (/help) and HelpAboutHandlers (callback)
 */
export const HELP_MESSAGE = `<b>🤖 Jumpa Commands:</b>

<b>General Commands:</b>
/start - Start the bot and register
/wallet - View your wallet information
/profile - View your profile details
/referral - View referral rewards
/deposit - Deposit assets to your wallet
/help - Show this help message

<b>For Support and suggestions</b>
@jumpatrading`;

/**
 * About message content
 */
export const ABOUT_MESSAGE = `ℹ️ <b>About Jumpa</b>

<b>What is Jumpa?</b>
Jumpa is a Telegram bot for multi-chain crypto trading, wallet management, and P2P fiat services.

<b>Key Features:</b>
  <b>Multi-Chain Wallets</b> (Solana, Stellar & EVM chains)
  <b>Token Trading</b> (DEX swaps)
  <b>Fiat Deposits</b> (via bank account)
  <b>Crypto Deposits</b> (via wallet addresses)
  <b>Fiat Withdrawals</b> (to bank account)
  <b>Crypto Withdrawals</b> (on-chain)
  <b>AI Assistant</b> for natural language withdrawals
  <b>Referral System</b> for community rewards
`;

/**
 * Get help message with optional keyboard
 * @param includeKeyboard - Whether to include the "Back to Main Menu" button
 */
export function getHelpContent(includeKeyboard: boolean = false) {
  if (includeKeyboard) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Back to Main Menu", "back_to_menu")]
    ]);

    return {
      message: HELP_MESSAGE,
      options: { parse_mode: "HTML" as const, ...keyboard }
    };
  }

  return {
    message: HELP_MESSAGE,
    options: { parse_mode: "HTML" as const }
  };
}

/**
 * Get about message with optional keyboard
 * @param includeKeyboard - Whether to include the "Back to Main Menu" button
 */
export function getAboutContent(includeKeyboard: boolean = false) {
  if (includeKeyboard) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Back to Main Menu", "back_to_menu")]
    ]);

    return {
      message: ABOUT_MESSAGE,
      options: { parse_mode: "HTML" as const, ...keyboard }
    };
  }

  return {
    message: ABOUT_MESSAGE,
    options: { parse_mode: "HTML" as const }
  };
}
