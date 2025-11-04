import { Context } from "telegraf";
import { Markup } from "telegraf";
import { getAllTokenBalances } from "@shared/utils/getTokenBalances";

export class DefaultWalletHandlers {
  // Handle set default Solana wallet callback
  static async handleSetDefaultSolanaWallet(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
    const cbData = (ctx.callbackQuery as any).data;

    if (!telegramId) {
      await ctx.answerCbQuery("❌ Unable to identify your account.");
      return;
    }

    try {
      // Format: set_default_solana:INDEX
      const walletIndex = parseInt(cbData.split(":")[1]);

      if (isNaN(walletIndex)) {
        await ctx.answerCbQuery("❌ Invalid wallet index.");
        return;
      }

      const User = (await import("@database/models/user")).default;
      const user = await User.findOne({ telegram_id: telegramId });

      if (!user || !user.solanaWallets[walletIndex]) {
        await ctx.answerCbQuery("❌ Wallet not found.");
        return;
      }

      // Check if already default
      if (walletIndex === 0) {
        await ctx.answerCbQuery("ℹ️ This is already your default wallet.");
        return;
      }

      // Delete the old message
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log("Could not delete message:", error);
      }

      // Move the selected wallet to index 0
      const selectedWallet = user.solanaWallets[walletIndex];
      user.solanaWallets.splice(walletIndex, 1);
      user.solanaWallets.unshift(selectedWallet);
      await user.save();

      await ctx.answerCbQuery("✅ Default wallet updated!");

      // Rebuild and display the complete wallet view
      const solanaWallets = user.solanaWallets || [];
      const evmWallets = user.evmWallets || [];
      const totalWallets = solanaWallets.length + evmWallets.length;

      // Build wallet list message
      let walletMessage = `<b>Your Wallets</b>\n\n`;

      // Display Solana wallets
      if (solanaWallets.length > 0) {
        walletMessage += `<b>🟣 Solana Wallets (${solanaWallets.length}/3)</b>\n`;

        for (let index = 0; index < solanaWallets.length; index++) {
          const wallet = solanaWallets[index];
          const balance = wallet.balance?.toFixed(4) || "0.0000";
          const lastUpdated = wallet.last_updated_balance
            ? new Date(wallet.last_updated_balance).toLocaleDateString()
            : "Never";

          // Fetch USDC and USDT balances for this wallet
          const tokenBalances = await getAllTokenBalances(wallet.address);

          const defaultBadge = index === 0 ? " ⭐ <b>(Default)</b>" : "";
          walletMessage += `\n<b>${index + 1}.</b> <code>${wallet.address}</code>${defaultBadge}\n`;
          walletMessage += `   SOL: ${balance}   • USDC: ${tokenBalances.usdc.toFixed(1)}   • USDT: ${tokenBalances.usdt.toFixed(1)}\n`;
          walletMessage += `   Updated: ${lastUpdated}\n`;
        }
        walletMessage += `\n`;
      }

      // Display EVM wallets
      if (evmWallets.length > 0) {
        walletMessage += `<b>🔵 EVM Wallets (${evmWallets.length}/3)</b>\n`;
        evmWallets.forEach((wallet, index) => {
          const balance = wallet.balance?.toFixed(4) || "0.0000";
          const lastUpdated = wallet.last_updated_balance
            ? new Date(wallet.last_updated_balance).toLocaleDateString()
            : "Never";
          const defaultBadge = index === 0 ? " ⭐ <b>(Default)</b>" : "";
          walletMessage += `\n<b>${index + 1}.</b> <code>${wallet.address}</code>${defaultBadge}\n`;
          walletMessage += `   Balance: ${balance} ETH\n`;
          walletMessage += `   Updated: ${lastUpdated}\n`;
        });
        walletMessage += `\n`;
      }

      // Add summary
      let totalSolBalance = 0;
      for (const wallet of solanaWallets) {
        totalSolBalance += Number(wallet.balance) || 0;
      }

      let totalEvmBalance = 0;
      for (const wallet of evmWallets) {
        totalEvmBalance += Number(wallet.balance) || 0;
      }

      walletMessage += `<b> Summary</b>\n`;
      walletMessage += `Total Wallets: ${totalWallets}\n`;
      if (solanaWallets.length > 0) {
        walletMessage += `Total SOL: ${totalSolBalance.toFixed(4)} SOL\n`;
      }
      if (evmWallets.length > 0) {
        walletMessage += `Total ETH: ${totalEvmBalance.toFixed(4)} ETH\n`;
      }

      // Build keyboard with set default buttons
      const keyboardButtons = [
        [
          Markup.button.callback("🔄 Refresh Balance", "refresh_balance"),
          Markup.button.callback("➕ Add Wallet", "add_wallet"),
        ],
      ];

      // Add "Set as Default" buttons for Solana wallets (skip first one as it's already default)
      if (solanaWallets.length > 1) {
        const solanaButtons = [];
        for (let i = 1; i < solanaWallets.length; i++) {
          const address = solanaWallets[i].address;
          const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
          solanaButtons.push(
            Markup.button.callback(`⭐ Set ${shortAddress} as Default`, `set_default_solana:${i}`)
          );
        }
        // Add buttons in rows of 2
        for (let i = 0; i < solanaButtons.length; i += 2) {
          keyboardButtons.push(solanaButtons.slice(i, i + 2));
        }
      }

      // Add "Set as Default" buttons for EVM wallets (skip first one as it's already default)
      if (evmWallets.length > 1) {
        const evmButtons = [];
        for (let i = 1; i < evmWallets.length; i++) {
          const address = evmWallets[i].address;
          const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
          evmButtons.push(
            Markup.button.callback(`⭐ Set ${shortAddress} as Default`, `set_default_evm:${i}`)
          );
        }
        // Add buttons in rows of 2
        for (let i = 0; i < evmButtons.length; i += 2) {
          keyboardButtons.push(evmButtons.slice(i, i + 2));
        }
      }

      keyboardButtons.push(
        [
          Markup.button.callback("💳 Deposit", "deposit_sol"),
          Markup.button.callback("💸 Withdraw", "withdraw_sol"),
        ],
        [
          Markup.button.callback("📊 My Profile", "view_profile"),
          Markup.button.callback("🔙 Back to Menu", "back_to_menu"),
        ]
      );

      const keyboard = Markup.inlineKeyboard(keyboardButtons);

      await ctx.reply(walletMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } catch (error) {
      console.error("Set default Solana wallet error:", error);
      await ctx.answerCbQuery("❌ Failed to set default wallet.");
    }
  }

  // Handle set default EVM wallet callback
  static async handleSetDefaultEVMWallet(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
    const cbData = (ctx.callbackQuery as any).data;

    if (!telegramId) {
      await ctx.answerCbQuery("❌ Unable to identify your account.");
      return;
    }

    try {
      // Format: set_default_evm:INDEX
      const walletIndex = parseInt(cbData.split(":")[1]);

      if (isNaN(walletIndex)) {
        await ctx.answerCbQuery("❌ Invalid wallet index.");
        return;
      }

      const User = (await import("@database/models/user")).default;
      const user = await User.findOne({ telegram_id: telegramId });

      if (!user || !user.evmWallets[walletIndex]) {
        await ctx.answerCbQuery("❌ Wallet not found.");
        return;
      }

      // Check if already default
      if (walletIndex === 0) {
        await ctx.answerCbQuery("ℹ️ This is already your default wallet.");
        return;
      }

      // Delete the old message
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log("Could not delete message:", error);
      }

      // Move the selected wallet to index 0
      const selectedWallet = user.evmWallets[walletIndex];
      user.evmWallets.splice(walletIndex, 1);
      user.evmWallets.unshift(selectedWallet);
      await user.save();

      await ctx.answerCbQuery("✅ Default wallet updated!");

      // Rebuild and display the complete wallet view
      const solanaWallets = user.solanaWallets || [];
      const evmWallets = user.evmWallets || [];
      const totalWallets = solanaWallets.length + evmWallets.length;

      // Build wallet list message
      let walletMessage = `<b>Your Wallets</b>\n\n`;

      // Display Solana wallets
      if (solanaWallets.length > 0) {
        walletMessage += `<b>🟣 Solana Wallets (${solanaWallets.length}/3)</b>\n`;

        for (let index = 0; index < solanaWallets.length; index++) {
          const wallet = solanaWallets[index];
          const balance = wallet.balance?.toFixed(4) || "0.0000";
          const lastUpdated = wallet.last_updated_balance
            ? new Date(wallet.last_updated_balance).toLocaleDateString()
            : "Never";

          // Fetch USDC and USDT balances for this wallet
          const tokenBalances = await getAllTokenBalances(wallet.address);

          const defaultBadge = index === 0 ? " ⭐ <b>(Default)</b>" : "";
          walletMessage += `\n<b>${index + 1}.</b> <code>${wallet.address}</code>${defaultBadge}\n`;
          walletMessage += `   SOL: ${balance}   • USDC: ${tokenBalances.usdc.toFixed(1)}   • USDT: ${tokenBalances.usdt.toFixed(1)}\n`;
          walletMessage += `   Updated: ${lastUpdated}\n`;
        }
        walletMessage += `\n`;
      }

      // Display EVM wallets
      if (evmWallets.length > 0) {
        walletMessage += `<b>🔵 EVM Wallets (${evmWallets.length}/3)</b>\n`;
        evmWallets.forEach((wallet, index) => {
          const balance = wallet.balance?.toFixed(4) || "0.0000";
          const lastUpdated = wallet.last_updated_balance
            ? new Date(wallet.last_updated_balance).toLocaleDateString()
            : "Never";
          const defaultBadge = index === 0 ? " ⭐ <b>(Default)</b>" : "";
          walletMessage += `\n<b>${index + 1}.</b> <code>${wallet.address}</code>${defaultBadge}\n`;
          walletMessage += `   Balance: ${balance} ETH\n`;
          walletMessage += `   Updated: ${lastUpdated}\n`;
        });
        walletMessage += `\n`;
      }

      // Add summary
      let totalSolBalance = 0;
      for (const wallet of solanaWallets) {
        totalSolBalance += Number(wallet.balance) || 0;
      }

      let totalEvmBalance = 0;
      for (const wallet of evmWallets) {
        totalEvmBalance += Number(wallet.balance) || 0;
      }

      walletMessage += `<b> Summary</b>\n`;
      walletMessage += `Total Wallets: ${totalWallets}\n`;
      if (solanaWallets.length > 0) {
        walletMessage += `Total SOL: ${totalSolBalance.toFixed(4)} SOL\n`;
      }
      if (evmWallets.length > 0) {
        walletMessage += `Total ETH: ${totalEvmBalance.toFixed(4)} ETH\n`;
      }

      // Build keyboard with set default buttons
      const keyboardButtons = [
        [
          Markup.button.callback("🔄 Refresh Balance", "refresh_balance"),
          Markup.button.callback("➕ Add Wallet", "add_wallet"),
        ],
      ];

      // Add "Set as Default" buttons for Solana wallets (skip first one as it's already default)
      if (solanaWallets.length > 1) {
        const solanaButtons = [];
        for (let i = 1; i < solanaWallets.length; i++) {
          const address = solanaWallets[i].address;
          const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
          solanaButtons.push(
            Markup.button.callback(`⭐ Set ${shortAddress} as Default`, `set_default_solana:${i}`)
          );
        }
        // Add buttons in rows of 2
        for (let i = 0; i < solanaButtons.length; i += 2) {
          keyboardButtons.push(solanaButtons.slice(i, i + 2));
        }
      }

      // Add "Set as Default" buttons for EVM wallets (skip first one as it's already default)
      if (evmWallets.length > 1) {
        const evmButtons = [];
        for (let i = 1; i < evmWallets.length; i++) {
          const address = evmWallets[i].address;
          const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
          evmButtons.push(
            Markup.button.callback(`⭐ Set ${shortAddress} as Default`, `set_default_evm:${i}`)
          );
        }
        // Add buttons in rows of 2
        for (let i = 0; i < evmButtons.length; i += 2) {
          keyboardButtons.push(evmButtons.slice(i, i + 2));
        }
      }

      keyboardButtons.push(
        [
          Markup.button.callback("💳 Deposit", "deposit_sol"),
          Markup.button.callback("💸 Withdraw", "withdraw_sol"),
        ],
        [
          Markup.button.callback("📊 My Profile", "view_profile"),
          Markup.button.callback("🔙 Back to Menu", "back_to_menu"),
        ]
      );

      const keyboard = Markup.inlineKeyboard(keyboardButtons);

      await ctx.reply(walletMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } catch (error) {
      console.error("Set default EVM wallet error:", error);
      await ctx.answerCbQuery("❌ Failed to set default wallet.");
    }
  }
}
