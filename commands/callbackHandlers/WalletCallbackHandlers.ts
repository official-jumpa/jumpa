import { Context } from "telegraf";
import getUser from "../../services/getUserInfo";
import { decryptPrivateKey } from "../../utils/encryption";

export class WalletCallbackHandlers {
  // Handle refresh balance callback
  static async handleRefreshBalance(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      // Show loading message
      await ctx.answerCbQuery("🔄 Refreshing balance...");

      // Get updated user info (this will refresh the balance)
      const user = await getUser(telegramId, username);

      if (!user) {
        await ctx.editMessageText("❌ User not found.");
        return;
      }

      // Update the message with new balance
      const updatedMessage = `
🔑 **Your Solana Wallet**

📍 **Address:** \`${user.wallet_address}\`
💰 **Balance:** ${user.user_balance} SOL
📅 **Last Updated:** ${user.last_updated_balance.toLocaleString()}

⚠️ **Security Note:** Keep your private key secure!
      `;

      await ctx.editMessageText(updatedMessage, {
        parse_mode: "Markdown",
      });

      await ctx.answerCbQuery("✅ Balance updated!");
    } catch (error) {
      console.error("Refresh balance error:", error);
      await ctx.answerCbQuery("❌ Failed to refresh balance.");
    }
  }

  // Handle copy address callback
  static async handleCopyAddress(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      const user = await getUser(telegramId, username);

      if (!user) {
        await ctx.answerCbQuery("❌ User not found.");
        return;
      }

      await ctx.answerCbQuery(`📍 Address copied: ${user.wallet_address}`);

      // Also send the address in a separate message for easy copying
      await ctx.reply(
        `📍 **Your Wallet Address:**\n\`${user.wallet_address}\``,
        {
          parse_mode: "Markdown",
        }
      );
    } catch (error) {
      console.error("Copy address error:", error);
      await ctx.answerCbQuery("❌ Failed to copy address.");
    }
  }

  // Handle show private key callback
  static async handleShowPrivateKey(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      const user = await getUser(telegramId, username);

      if (!user) {
        await ctx.answerCbQuery("❌ User not found.");
        return;
      }

      // Decrypt the private key
      const privateKey = decryptPrivateKey(user.private_key);

      // Send private key in a separate message with security warning
      const privateKeyMessage = `
🔐 **Your Private Key**

⚠️ **CRITICAL SECURITY WARNING** ⚠️
- Never share this key with anyone
- Anyone with this key can access your wallet
- Store it securely offline

**Private Key:** \`${privateKey}\`

⚠️ **This message will auto-delete in 2 minutes!**
      `;

      // Create keyboard with back button
      const { Markup } = await import("telegraf");
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Wallet", "view_wallet")],
      ]);

      const message = await ctx.reply(privateKeyMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });

      // Auto-delete the message after 2 minutes (120 seconds)
      setTimeout(async () => {
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, message.message_id);
        } catch (deleteError) {
          console.log("Could not delete private key message:", deleteError);
        }
      }, 120000); // 2 minutes in milliseconds

      await ctx.answerCbQuery("🔐 Private key sent (auto-deletes in 2 mins)");
    } catch (error) {
      console.error("Show private key error:", error);
      await ctx.answerCbQuery("❌ Failed to retrieve private key.");
    }
  }

  // Handle wallet details callback
  static async handleWalletDetails(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      const user = await getUser(telegramId, username);

      if (!user) {
        await ctx.answerCbQuery("❌ User not found.");
        return;
      }

      const detailsMessage = `
📊 **Wallet Details**

👤 **User:** ${username}
🆔 **Telegram ID:** ${user.telegram_id}
📍 **Wallet Address:** \`${user.wallet_address}\`
💰 **Current Balance:** ${user.user_balance} SOL
📅 **Created:** ${user.created_at.toLocaleString()}
🔄 **Last Updated:** ${user.last_updated_balance.toLocaleString()}
🔒 **Status:** ${user.is_active ? "Active" : "Inactive"}
👑 **Role:** ${user.role}

🔗 **View on Solana Explorer:**
https://explorer.solana.com/address/${user.wallet_address}
      `;

      await ctx.reply(detailsMessage, {
        parse_mode: "Markdown",
      });

      await ctx.answerCbQuery("📊 Details sent!");
    } catch (error) {
      console.error("Wallet details error:", error);
      await ctx.answerCbQuery("❌ Failed to get wallet details.");
    }
  }

  // Handle close wallet callback
  static async handleCloseWallet(ctx: Context): Promise<void> {
    try {
      await ctx.deleteMessage();
      await ctx.answerCbQuery("👋 Wallet info closed");
    } catch (error) {
      console.error("Close wallet error:", error);
      await ctx.answerCbQuery("❌ Failed to close wallet info.");
    }
  }
}
