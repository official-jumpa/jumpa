/**
 * Message Formatters
 * Unified message formatting for group operations across blockchains
 */

import { GroupInfo, GroupState } from "@blockchain/core/types/CommonTypes";
import { BlockchainType } from "@blockchain/core/types/BlockchainType";
import { BlockchainDetector } from "@blockchain/core/utils";

export class MessageFormatters {
  /**
   * Format group info message
   */
  static formatGroupInfo(groupInfo: GroupInfo): string {
    const chainName = BlockchainDetector.getDisplayName(groupInfo.blockchain);
    const currency = groupInfo.currency;
    const state = this.formatGroupState(groupInfo.state);

    let message = `
<b>${groupInfo.isPrivate ? "🔒 Private" : "🌐 Public"} Group - ${groupInfo.name}</b>

<b>Blockchain:</b> ${chainName}

<b>Group Address:</b> <code>${groupInfo.groupAddress}</code>

<b>Status:</b> ${state}

<b>👥 Members:</b> ${groupInfo.members.length}
<b>📊 Traders:</b> ${groupInfo.traders.length}

<b>💰 Financial Info:</b>
• <b>Minimum Deposit:</b> ${groupInfo.minimumDeposit.toFixed(4)} ${currency}
• <b>Total Contributions:</b> ${groupInfo.totalContributions.toFixed(4)} ${currency}
`;

    // Add blockchain-specific fields
    if (groupInfo.blockchain === BlockchainType.BASE) {
      if (groupInfo.maxSlippagePercentage !== undefined) {
        message += `\n<b>⚙️ Trading Settings:</b>\n`;
        message += `• <b>Max Slippage:</b> ${groupInfo.maxSlippagePercentage}%\n`;
        if (groupInfo.maxSwapPercentage !== undefined) {
          message += `• <b>Max Swap:</b> ${groupInfo.maxSwapPercentage}%\n`;
        }
      }
    } else if (groupInfo.blockchain === BlockchainType.SOLANA) {
      if (groupInfo.exitPenaltyPercentage !== undefined || groupInfo.lockPeriodDays !== undefined) {
        message += `\n<b>⚙️ Group Settings:</b>\n`;
        if (groupInfo.exitPenaltyPercentage !== undefined) {
          message += `• <b>Exit Penalty:</b> ${groupInfo.exitPenaltyPercentage}%\n`;
        }
        if (groupInfo.lockPeriodDays !== undefined) {
          message += `• <b>Lock Period:</b> ${groupInfo.lockPeriodDays} days\n`;
        }
      }
    }

    message += `\n<b>📅 Created:</b> ${groupInfo.createdAt.toLocaleDateString()}`;

    return message.trim();
  }

  /**
   * Format group state
   */
  private static formatGroupState(state: GroupState): string {
    const stateMap: Record<GroupState, string> = {
      [GroupState.OPEN]: "Open 🟢",
      [GroupState.TRADING]: "Trading 🔵",
      [GroupState.CLOSED]: "Closed 🔴",
      [GroupState.PAUSED]: "Paused ⏸️",
      [GroupState.LOCKED]: "Locked 🔒"
    };
    return stateMap[state] || "Unknown";
  }

  /**
   * Format join success message
   */
  static formatJoinSuccess(
    groupName: string,
    blockchain: BlockchainType,
    groupAddress: string,
    contribution: number,
    memberCount: number,
    txHash: string
  ): string {
    const chainName = BlockchainDetector.getDisplayName(blockchain);
    const currency = BlockchainDetector.getNativeCurrency(blockchain);
    const chainEmoji = blockchain === BlockchainType.BASE ? "⛓️" : "◎";

    return `
<b>✅ Successfully Joined Group!</b>

<b>Group Name:</b> ${groupName}
<b>Blockchain:</b> ${chainName} ${chainEmoji}

<b>Group Address:</b> <code>${groupAddress}</code>

<b>💰 Your Contribution:</b> ${contribution.toFixed(4)} ${currency}

<b>👥 Total Members:</b> ${memberCount}

<b>Transaction Hash:</b> <code>${txHash}</code>

You are now a member of this group! 🚀
    `.trim();
  }

  /**
   * Format leave success message
   */
  static formatLeaveSuccess(
    groupName: string,
    blockchain: BlockchainType,
    groupAddress: string,
    withdrawal: number,
    contribution: number,
    remainingMembers: number,
    txHash: string
  ): string {
    const chainName = BlockchainDetector.getDisplayName(blockchain);
    const currency = BlockchainDetector.getNativeCurrency(blockchain);
    const chainEmoji = blockchain === BlockchainType.BASE ? "⛓️" : "◎";

    return `
<b>✅ Successfully Left Group!</b>

<b>Group Name:</b> ${groupName}
<b>Blockchain:</b> ${chainName} ${chainEmoji}

<b>Group Address:</b> <code>${groupAddress}</code>

<b>💰 Financial Summary:</b>
• <b>Your Contribution:</b> ${contribution.toFixed(4)} ${currency}
• <b>Withdrawal Amount:</b> ${withdrawal.toFixed(4)} ${currency}

<b>👥 Remaining Members:</b> ${remainingMembers}

<b>Transaction Hash:</b> <code>${txHash}</code>

Your funds have been returned to your wallet. You can rejoin anytime! 👋
    `.trim();
  }

  /**
   * Format error message
   */
  static formatError(
    operation: string,
    blockchain: BlockchainType,
    groupAddress: string,
    error: string
  ): string {
    const chainName = BlockchainDetector.getDisplayName(blockchain);

    return `
<b>❌ Failed to ${operation}</b>

<b>Blockchain:</b> ${chainName}
<b>Group Address:</b> <code>${groupAddress}</code>

<b>Reason:</b> ${error}

Please try again later or contact support if the issue persists.
    `.trim();
  }

  /**
   * Format loading message
   */
  static formatLoading(operation: string, blockchain: BlockchainType): string {
    const chainName = BlockchainDetector.getDisplayName(blockchain);
    return `⏳ ${operation} on ${chainName}... This might take up to a minute`;
  }
}
