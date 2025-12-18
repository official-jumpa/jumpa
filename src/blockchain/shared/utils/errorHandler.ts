/**
 * Blockchain Error Handler
 * Provides unified error handling across blockchains
 */

import { BlockchainType } from "../types/BlockchainType";

export class BlockchainErrorHandler {
  /**
   * Handle blockchain errors and return user-friendly messages
   */
  static handle(error: any, blockchain: BlockchainType): string {
    if (blockchain === BlockchainType.BASE) {
      return this.handleBaseError(error);
    } else if (blockchain === BlockchainType.SOLANA) {
      return this.handleSolanaError(error);
    }
    return this.getGenericErrorMessage(error);
  }

  /**
   * Handle Base (EVM) blockchain errors
   */
  private static handleBaseError(error: any): string {
    const errorCode = error?.code;
    const errorMessage = error?.message || error?.info?.error?.message || "";

    // Common EVM error codes
    if (errorCode === "INSUFFICIENT_FUNDS") {
      return "Insufficient ETH balance for gas fees";
    }

    if (errorCode === "CALL_EXCEPTION") {
      return "Smart contract call failed. Please check group state and try again.";
    }

    if (errorCode === "UNPREDICTABLE_GAS_LIMIT") {
      return "Transaction will likely fail. Please check your inputs and try again.";
    }

    if (errorCode === "NONCE_EXPIRED") {
      return "Transaction nonce expired. Please try again.";
    }

    if (errorCode === "REPLACEMENT_UNDERPRICED") {
      return "Transaction underpriced. Please try again with higher gas.";
    }

    if (errorCode === "NETWORK_ERROR") {
      return "Network error. Please check your connection and try again.";
    }

    if (errorCode === "TIMEOUT") {
      return "Transaction timeout. It may still succeed - check the blockchain explorer.";
    }

    // Check for specific error messages
    if (errorMessage.includes("insufficient funds")) {
      return "Insufficient ETH balance for this transaction";
    }

    if (errorMessage.includes("execution reverted")) {
      return "Transaction reverted. Please check group requirements.";
    }

    if (errorMessage.includes("user rejected")) {
      return "Transaction was rejected";
    }

    return errorMessage || "Unknown Base blockchain error occurred";
  }

  /**
   * Handle Solana blockchain errors
   */
  private static handleSolanaError(error: any): string {
    const errorMessage = error?.message || error?.toString() || "";

    // Solana-specific errors
    if (errorMessage.includes("Insufficient SOL") || errorMessage.includes("insufficient funds")) {
      const match = errorMessage.match(/Your balance: ([\d.]+) SOL/);
      if (match) {
        return `Insufficient SOL balance. Your balance: ${match[1]} SOL. Please fund your wallet.`;
      }
      return "Insufficient SOL balance for this transaction";
    }

    if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
      return "Transaction timeout. It may still succeed on-chain - check Solscan explorer.";
    }

    if (errorMessage.includes("User not found")) {
      return "User not registered. Please use /start to register first.";
    }

    if (errorMessage.includes("already exists on-chain")) {
      return errorMessage; // Already user-friendly
    }

    if (errorMessage.includes("Blockhash not found")) {
      return "Transaction expired. Please try again.";
    }

    if (errorMessage.includes("custom program error")) {
      return "Smart contract error. Please check group requirements and try again.";
    }

    if (errorMessage.includes("failed to send transaction")) {
      return "Failed to send transaction. Please check your connection and try again.";
    }

    if (errorMessage.includes("Account does not exist")) {
      return "Group or account does not exist on-chain. Please verify the address.";
    }

    if (errorMessage.includes("Transaction simulation failed")) {
      return "Transaction simulation failed. Please check inputs and try again.";
    }

    return errorMessage || "Unknown Solana blockchain error occurred";
  }

  /**
   * Get generic error message
   */
  private static getGenericErrorMessage(error: any): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return "An unknown error occurred";
  }

  /**
   * Check if error is a user cancellation
   */
  static isUserCancellation(error: any): boolean {
    const message = error?.message?.toLowerCase() || "";
    return message.includes("user rejected") ||
           message.includes("user denied") ||
           message.includes("cancelled");
  }

  /**
   * Check if error is a network issue
   */
  static isNetworkError(error: any): boolean {
    const code = error?.code || "";
    const message = error?.message?.toLowerCase() || "";
    return code === "NETWORK_ERROR" ||
           message.includes("network") ||
           message.includes("connection");
  }

  /**
   * Check if error is insufficient funds
   */
  static isInsufficientFunds(error: any): boolean {
    const code = error?.code || "";
    const message = error?.message?.toLowerCase() || "";
    return code === "INSUFFICIENT_FUNDS" ||
           message.includes("insufficient funds") ||
           message.includes("insufficient sol");
  }
}
