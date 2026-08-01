import { Markup } from "telegraf";

/**
 * Centralized help content for the bot
 * Used by both HelpCommand (/help) and HelpAboutHandlers (callback)
 */
export const HELP_MESSAGE = `<b>🤖 Jumpa Bot Commands:</b>

<b>General Commands:</b>
/start - Start the bot and register
/wallet - View your wallet information
/profile - View your profile details
/referral - View referral rewards
/deposit - Deposit funds
/help - Show this help message

<b>Need Support?</b>
Contact @official_jumpa_bot for help!`;

/**
 * About message content
 */
export const ABOUT_MESSAGE = `ℹ️ <b>About Jumpa Bot</b>

<b>What is Jumpa?</b>
Jumpa is a Telegram trading bot for multi-chain crypto trading, wallet management, and P2P fiat withdrawals.

<b>Key Features:</b>
  <b>Multi-Chain Wallets</b> (Solana & EVM)
  <b>Token Trading</b> (Jupiter / DEX swaps)
  <b>Instant Fiat Withdrawals</b> (off-ramp)
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
