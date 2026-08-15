import { Context } from "telegraf";
import getUser from "@src/features/users/getUserInfo";
import { handleViewWallet } from "./WalletViewHandlers";

// Handle set default Solana wallet callback
export async function handleSetDefaultSolanaWallet(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
  const cbData = (ctx.callbackQuery as any)?.data;

  if (!telegramId || !cbData) {
    await ctx.answerCbQuery("❌ Unable to identify your account.");
    return;
  }

  try {
    const walletIndex = parseInt(cbData.split(":")[1]);

    if (isNaN(walletIndex)) {
      await ctx.answerCbQuery("❌ Invalid wallet index.");
      return;
    }

    const user = await getUser(telegramId, username);

    if (!user || !user.solanaWallets[walletIndex]) {
      await ctx.answerCbQuery("❌ Wallet not found.");
      return;
    }

    if (walletIndex === 0) {
      await ctx.answerCbQuery("ℹ️ This is already your default wallet.");
      return;
    }

    // Move the selected wallet to index 0
    const selectedWallet = user.solanaWallets[walletIndex];
    user.solanaWallets.splice(walletIndex, 1);
    user.solanaWallets.unshift(selectedWallet);
    await user.save();

    await ctx.answerCbQuery("✅ Default wallet updated!");

    // Re-render updated wallet view cleanly (defaults to solana 0)
    await handleViewWallet(ctx, "solana", 0);
  } catch (error) {
    console.error("Set default Solana wallet error:", error);
    await ctx.answerCbQuery("❌ Failed to set default wallet.");
  }
}

// Handle set default EVM wallet callback
export async function handleSetDefaultEVMWallet(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
  const cbData = (ctx.callbackQuery as any)?.data;

  if (!telegramId || !cbData) {
    await ctx.answerCbQuery("❌ Unable to identify your account.");
    return;
  }

  try {
    const walletIndex = parseInt(cbData.split(":")[1]);

    if (isNaN(walletIndex)) {
      await ctx.answerCbQuery("❌ Invalid wallet index.");
      return;
    }
    const user = await getUser(telegramId, username);

    if (!user || !user.evmWallets[walletIndex]) {
      await ctx.answerCbQuery("❌ Wallet not found.");
      return;
    }

    if (walletIndex === 0) {
      await ctx.answerCbQuery("ℹ️ This is already your default wallet.");
      return;
    }

    // Move the selected wallet to index 0
    const selectedWallet = user.evmWallets[walletIndex];
    user.evmWallets.splice(walletIndex, 1);
    user.evmWallets.unshift(selectedWallet);
    await user.save();

    await ctx.answerCbQuery("✅ Default wallet updated!");

    // Re-render updated wallet view cleanly (defaults to EVM 0)
    await handleViewWallet(ctx, "evm", 0);
  } catch (error) {
    console.error("Set default EVM wallet error:", error);
    await ctx.answerCbQuery("❌ Failed to set default wallet.");
  }
}

// Handle delete Solana wallet callback
export async function handleDeleteSolanaWallet(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const cbData = (ctx.callbackQuery as any)?.data;

  if (!telegramId || !cbData) {
    await ctx.answerCbQuery("❌ Unable to identify your account.");
    return;
  }

  try {
    const [action, indexStr] = cbData.split(":");
    const walletIndex = parseInt(indexStr);

    if (isNaN(walletIndex)) {
      await ctx.answerCbQuery("❌ Invalid wallet index.");
      return;
    }

    const User = (await import("@core/database/models/user")).default;
    const user = await User.findOne({ telegram_id: telegramId });

    if (!user || !user.solanaWallets[walletIndex]) {
      await ctx.answerCbQuery("❌ Wallet not found.");
      return;
    }

    const wallet = user.solanaWallets[walletIndex];
    const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;

    if (action === "delete_solana_wallet") {
      await ctx.answerCbQuery("⚠️ Confirm deletion");

      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log("Could not delete message:", error);
      }

      const confirmMessage = `⚠️ <b>Confirm Deletion</b>\n\nAre you sure you want to delete Sol Wallet ${walletIndex + 1}?\n\n<b>Address:</b> <code>${shortAddress}</code>\n\n<b>Warning:</b> This action cannot be undone. Make sure you have backed up your private key before proceeding.`;

      const { Markup } = await import("telegraf");
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Yes, Delete", `confirm_delete_solana:${walletIndex}`),
          Markup.button.callback("❌ Cancel", "view_wallet"),
        ],
      ]);

      await ctx.reply(confirmMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
      return;
    }

    if (action === "confirm_delete_solana") {
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log("Could not delete message:", error);
      }

      user.solanaWallets.splice(walletIndex, 1);
      await user.save();

      await ctx.answerCbQuery("✅ Wallet deleted successfully!");

      await ctx.reply(
        `🗑️ Sol Wallet ${walletIndex + 1} (${shortAddress}) has been deleted.`,
        { parse_mode: "HTML" }
      );

      if (user.solanaWallets.length > 0 || user.evmWallets.length > 0) {
        await handleViewWallet(ctx);
      } else {
        await ctx.reply(
          "You have no wallets left. Use /start to set up a new wallet.",
          { parse_mode: "HTML" }
        );
      }
    }
  } catch (error) {
    console.error("Delete Solana wallet error:", error);
    await ctx.answerCbQuery("❌ Failed to delete wallet.");
  }
}

// Handle delete EVM wallet callback
export async function handleDeleteEVMWallet(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const cbData = (ctx.callbackQuery as any)?.data;

  if (!telegramId || !cbData) {
    await ctx.answerCbQuery("❌ Unable to identify your account.");
    return;
  }

  try {
    const [action, indexStr] = cbData.split(":");
    const walletIndex = parseInt(indexStr);

    if (isNaN(walletIndex)) {
      await ctx.answerCbQuery("❌ Invalid wallet index.");
      return;
    }

    const User = (await import("@core/database/models/user")).default;
    const user = await User.findOne({ telegram_id: telegramId });

    if (!user || !user.evmWallets[walletIndex]) {
      await ctx.answerCbQuery("❌ Wallet not found.");
      return;
    }

    const wallet = user.evmWallets[walletIndex];
    const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;

    if (action === "delete_evm_wallet") {
      await ctx.answerCbQuery("⚠️ Confirm deletion");

      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log("Could not delete message:", error);
      }

      const confirmMessage = `⚠️ <b>Confirm Deletion</b>\n\nAre you sure you want to delete EVM Wallet ${walletIndex + 1}?\n\n<b>Address:</b> <code>${shortAddress}</code>\n\n<b>Warning:</b> This action cannot be undone. Make sure you have backed up your private key before proceeding.`;

      const { Markup } = await import("telegraf");
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Yes, Delete", `confirm_delete_evm:${walletIndex}`),
          Markup.button.callback("❌ Cancel", "view_wallet"),
        ],
      ]);

      await ctx.reply(confirmMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
      return;
    }

    if (action === "confirm_delete_evm") {
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log("Could not delete message:", error);
      }

      user.evmWallets.splice(walletIndex, 1);
      await user.save();

      await ctx.answerCbQuery("✅ Wallet deleted successfully!");

      await ctx.reply(
        `🗑️ EVM Wallet ${walletIndex + 1} (${shortAddress}) has been deleted.`,
        { parse_mode: "HTML" }
      );

      if (user.solanaWallets.length > 0 || user.evmWallets.length > 0 || (user.stellarWallets && user.stellarWallets.length > 0)) {
        await handleViewWallet(ctx);
      } else {
        await ctx.reply(
          "You have no wallets left. Use /start to set up a new wallet.",
          { parse_mode: "HTML" }
        );
      }
    }
  } catch (error) {
    console.error("Delete EVM wallet error:", error);
    await ctx.answerCbQuery("❌ Failed to delete wallet.");
  }
}

// Handle set default Stellar wallet callback
export async function handleSetDefaultStellarWallet(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
  const cbData = (ctx.callbackQuery as any)?.data;

  if (!telegramId || !cbData) {
    await ctx.answerCbQuery("❌ invalid account.");
    return;
  }

  try {
    const walletIndex = parseInt(cbData.split(":")[1]);

    if (isNaN(walletIndex)) {
      await ctx.answerCbQuery("❌ Invalid wallet index.");
      return;
    }
    const user = await getUser(telegramId, username);

    if (!user || !user.stellarWallets || !user.stellarWallets[walletIndex]) {
      await ctx.answerCbQuery("❌ Wallet not found.");
      return;
    }

    if (walletIndex === 0) {
      await ctx.answerCbQuery("ℹ️ This is already your default wallet.");
      return;
    }

    // Move the selected wallet to index 0
    const selectedWallet = user.stellarWallets[walletIndex];
    user.stellarWallets.splice(walletIndex, 1);
    user.stellarWallets.unshift(selectedWallet);
    await user.save();

    await ctx.answerCbQuery("✅ Default wallet updated!");

    // Re-render updated wallet view cleanly (defaults to Stellar 0)
    await handleViewWallet(ctx, "stellar", 0);
  } catch (error) {
    console.error("Set default Stellar wallet error:", error);
    await ctx.answerCbQuery("❌ Failed to set default wallet.");
  }
}

// Handle delete Stellar wallet callback
export async function handleDeleteStellarWallet(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const cbData = (ctx.callbackQuery as any)?.data;

  if (!telegramId || !cbData) {
    await ctx.answerCbQuery("❌ Unable to identify your account.");
    return;
  }

  try {
    const [action, indexStr] = cbData.split(":");
    const walletIndex = parseInt(indexStr);

    if (isNaN(walletIndex)) {
      await ctx.answerCbQuery("❌ Invalid wallet index.");
      return;
    }

    const User = (await import("@core/database/models/user")).default;
    const user = await User.findOne({ telegram_id: telegramId });

    if (!user || !user.stellarWallets || !user.stellarWallets[walletIndex]) {
      await ctx.answerCbQuery("❌ Wallet not found.");
      return;
    }

    const wallet = user.stellarWallets[walletIndex];
    const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;

    if (action === "delete_stellar_wallet") {
      await ctx.answerCbQuery("⚠️ Confirm deletion");

      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log("Could not delete message:", error);
      }

      const confirmMessage = `⚠️ <b>Confirm Deletion</b>\n\nAre you sure you want to delete Stellar Wallet ${walletIndex + 1}?\n\n<b>Address:</b> <code>${shortAddress}</code>\n\n<b>Warning:</b> This action cannot be undone. Make sure you have backed up your private key before proceeding.`;

      const { Markup } = await import("telegraf");
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Yes, Delete", `confirm_delete_stellar:${walletIndex}`),
          Markup.button.callback("❌ Cancel", "view_wallet"),
        ],
      ]);

      await ctx.reply(confirmMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
      return;
    }

    if (action === "confirm_delete_stellar") {
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log("Could not delete message:", error);
      }

      user.stellarWallets.splice(walletIndex, 1);
      await user.save();

      await ctx.answerCbQuery("✅ Wallet deleted successfully!");

      await ctx.reply(
        `🗑️ Stellar Wallet ${walletIndex + 1} (${shortAddress}) has been deleted.`,
        { parse_mode: "HTML" }
      );

      const hasSolana = user.solanaWallets && user.solanaWallets.length > 0;
      const hasEvm = user.evmWallets && user.evmWallets.length > 0;
      const hasStellar = user.stellarWallets && user.stellarWallets.length > 0;

      if (hasSolana || hasEvm || hasStellar) {
        await handleViewWallet(ctx);
      } else {
        await ctx.reply(
          "You have no wallets left. Use /start to set up a new wallet.",
          { parse_mode: "HTML" }
        );
      }
    }
  } catch (error) {
    console.error("Delete Stellar wallet error:", error);
    await ctx.answerCbQuery("❌ Failed to delete wallet.");
  }
}
