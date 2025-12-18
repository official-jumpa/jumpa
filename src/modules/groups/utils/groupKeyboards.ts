/**
 * Group Keyboard Builders
 * Creates inline keyboards for group management operations
 */

import { Markup } from "telegraf";
import { InlineKeyboardMarkup } from "telegraf/types";
import { GroupInfo, GroupState } from "@blockchain/core/types/CommonTypes";

export class GroupKeyboards {
  /**
   * Create inline keyboard for group info display
   */
  static createGroupKeyboard(groupInfo: GroupInfo): { reply_markup: InlineKeyboardMarkup } {
    const buttons = [];

    // Row 1: Members
    buttons.push([
      Markup.button.callback("👥 Members", "group_members")
    ]);

    // Row 2: Deposit and Exit (only if group is open or trading)
    if (groupInfo.state === GroupState.OPEN || groupInfo.state === GroupState.TRADING) {
      buttons.push([
        Markup.button.callback("💰 Deposit", "group_deposit"),
        Markup.button.callback("🚪 Exit", "group_exit")
      ]);
    }

    // Row 3: Settings and More (only if group is not closed)
    if (groupInfo.state !== GroupState.CLOSED) {
      buttons.push([
        Markup.button.callback("⚙️ Settings", "group_settings"),
        Markup.button.callback("➕ More", "group_more")
      ]);
    }

    // Row 4: Help and Refresh
    buttons.push([
      Markup.button.callback("❓ Help", "group_help"),
      Markup.button.callback("🔄 Refresh", "group_refresh")
    ]);

    return Markup.inlineKeyboard(buttons);
  }

  /**
   * Create keyboard for group creation options
   */
  static createGroupCreationKeyboard(): { reply_markup: InlineKeyboardMarkup } {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("Create Base Group", "create_base_group"),
        Markup.button.callback("Create Solana Group", "create_solana_group")
      ],
      [
        Markup.button.callback("❌ Cancel", "cancel_group_creation")
      ]
    ]);
  }

  /**
   * Create keyboard for blockchain selection
   */
  static createBlockchainSelectionKeyboard(): { reply_markup: InlineKeyboardMarkup } {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("Base ⛓️", "select_base"),
        Markup.button.callback("Solana ◎", "select_solana")
      ],
      [
        Markup.button.callback("❌ Cancel", "cancel_selection")
      ]
    ]);
  }

  /**
   * Create keyboard for group privacy selection
   */
  static createPrivacySelectionKeyboard(): { reply_markup: InlineKeyboardMarkup } {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("🌐 Public Group", "privacy_public"),
        Markup.button.callback("🔒 Private Group", "privacy_private")
      ],
      [
        Markup.button.callback("❌ Cancel", "cancel_privacy")
      ]
    ]);
  }

  /**
   * Create confirmation keyboard for dangerous operations
   */
  static createConfirmationKeyboard(action: string): { reply_markup: InlineKeyboardMarkup } {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("✅ Confirm", `confirm_${action}`),
        Markup.button.callback("❌ Cancel", `cancel_${action}`)
      ]
    ]);
  }
}
