import { Context, Markup } from "telegraf";
import getUser from "@features/users/getUserInfo";
import { getAllTokenBalances } from "@shared/utils/getTokenBalances";
import { getAllEvmBalances } from "@shared/utils/getEvmBalances";
import getStellarBalances from "@shared/utils/getStellarBalances";
import getTonBalances from "@shared/utils/getTonBalances";

export type ChainType = "solana" | "evm" | "stellar" | "ton";

/**
 * Build skeleton wallet view with loading indicators
 */
function buildWalletSkeleton(
  user: any,
  activeChain: ChainType = "solana",
  activeWalletIndex: number = 0
): string {
  let message = "*Your Wallets*\n\n";
  message += `*Total Value:* ⏳\n\n`;

  const solanaWallets = user.solanaWallets || [];
  const evmWallets = user.evmWallets || [];
  const stellarWallets = user.stellarWallets || [];
  const tonWallets = user.tonWallets || [];

  if (activeChain === "solana" && solanaWallets.length > 0) {
    const wallet = solanaWallets[activeWalletIndex] || solanaWallets[0];
    const isMain = activeWalletIndex === 0;
    const defaultBadge = isMain ? " 🟢 *(Default)*" : "";

    message += `*🟣 Solana Wallet ${activeWalletIndex + 1}*\n`;
    message += `\`${wallet.address}\`${defaultBadge}\n\n`;
    message += `SOL: ⏳ ...   • USDC: ⏳ ...   • USDT: ⏳ ...\n`;
  } else if (activeChain === "evm" && evmWallets.length > 0) {
    const wallet = evmWallets[activeWalletIndex] || evmWallets[0];
    const isMain = activeWalletIndex === 0;
    const defaultBadge = isMain ? " 🟢 *(Default)*" : "";

    message += `*🔵 EVM Wallet ${activeWalletIndex + 1}*\n`;
    message += `\`${wallet.address}\`${defaultBadge}\n\n`;
    message += `*Base:* ⏳ ... ETH • ⏳ ... USDC\n`;
    message += `*Celo:* ⏳ ... ETH • ⏳ ... cUSD\n`;
  } else if (activeChain === "stellar" && stellarWallets.length > 0) {
    const wallet = stellarWallets[activeWalletIndex] || stellarWallets[0];
    const isMain = activeWalletIndex === 0;
    const defaultBadge = isMain ? " 🟢 *(Default)*" : "";

    message += `*⭐ Stellar Wallet ${activeWalletIndex + 1}*\n`;
    message += `\`${wallet.address}\`${defaultBadge}\n\n`;
    message += `XLM: ⏳ ...   • USDC: ⏳ ...\n`;
  } else if (activeChain === "ton" && tonWallets.length > 0) {
    const wallet = tonWallets[activeWalletIndex] || tonWallets[0];
    const isMain = activeWalletIndex === 0;
    const defaultBadge = isMain ? " 🟢 *(Default)*" : "";

    message += `*💎 TON Wallet ${activeWalletIndex + 1}*\n`;
    message += `\`${wallet.address}\`${defaultBadge}\n\n`;
    message += `TON: ⏳ ...   • USDT: ⏳ ...\n`;
  } else {
    message += `No active wallet found for ${activeChain.toUpperCase()}.\n`;
  }

  return message;
}

/**
 * Calculate total portfolio value in USD
 */
function calculateTotalNetWorth(
  solBalancesArray: any[],
  evmBalancesArray: any[],
  stellarBalancesArray: any[],
  tonBalancesArray: any[] = []
): number {
  let totalUsd = 0;

  // Solana USD estimates (approx SOL=$180)
  for (const bal of solBalancesArray) {
    if (bal) {
      totalUsd += (bal.sol || 0) * 180 + (bal.usdc || 0) + (bal.usdt || 0);
    }
  }

  // EVM USD estimates (approx ETH=$3200)
  for (const bal of evmBalancesArray) {
    if (bal) {
      const baseVal = ((bal.BASE?.eth || 0) * 3200) + (bal.BASE?.usdc || 0) + (bal.BASE?.usdt || 0);
      const celoVal = ((bal.CELO?.eth || 0) * 3200) + (bal.CELO?.usdc || 0) + (bal.CELO?.usdt || 0);
      totalUsd += baseVal + celoVal;
    }
  }

  // Stellar USD estimates (approx XLM=$0.12)
  for (const bal of stellarBalancesArray) {
    if (bal) {
      totalUsd += (bal.xlm || 0) * 0.12 + (bal.usdc || 0);
    }
  }

  // TON USD estimates (approx TON=$5.50)
  for (const bal of tonBalancesArray) {
    if (bal) {
      totalUsd += (bal.ton || 0) * 5.5 + (bal.usdt || 0);
    }
  }

  return totalUsd;
}

/**
 * Build complete wallet view with real balances
 */
function buildWalletComplete(
  user: any,
  solBalancesArray: any[],
  evmBalancesArray: any[],
  stellarBalancesArray: any[],
  tonBalancesArray: any[] = [],
  activeChain: ChainType = "solana",
  activeWalletIndex: number = 0
): string {
  let message = "*Your Wallets*\n\n";

  const totalUsd = calculateTotalNetWorth(
    solBalancesArray,
    evmBalancesArray,
    stellarBalancesArray,
    tonBalancesArray
  );
  message += `*Total Value:* $${totalUsd.toFixed(2)} USD\n\n`;

  const solanaWallets = user.solanaWallets || [];
  const evmWallets = user.evmWallets || [];
  const stellarWallets = user.stellarWallets || [];
  const tonWallets = user.tonWallets || [];

  if (activeChain === "solana" && solanaWallets.length > 0) {
    const idx = Math.min(activeWalletIndex, solanaWallets.length - 1);
    const wallet = solanaWallets[idx];
    const balances = solBalancesArray[idx];
    const isMain = idx === 0;
    const defaultBadge = isMain ? " 🟢 *(Default)*" : "";

    message += `*🟣 Solana Wallet ${idx + 1}*\n`;
    message += `\`${wallet.address}\`${defaultBadge}\n\n`;

    if (balances) {
      message += `SOL: ${balances.sol.toFixed(4)}   • USDC: ${balances.usdc.toFixed(2)}   • USDT: ${balances.usdt.toFixed(2)}\n`;
    } else {
      message += `SOL: 0.0000   • USDC: 0.00   • USDT: 0.00\n`;
    }
  } else if (activeChain === "evm" && evmWallets.length > 0) {
    const idx = Math.min(activeWalletIndex, evmWallets.length - 1);
    const wallet = evmWallets[idx];
    const balances = evmBalancesArray[idx];
    const isMain = idx === 0;
    const defaultBadge = isMain ? " 🟢 *(Default)*" : "";

    message += `*🔵 EVM Wallet ${idx + 1}*\n`;
    message += `\`${wallet.address}\`${defaultBadge}\n\n`;

    if (balances) {
      message += `*Base:* ${(balances.BASE?.eth || 0).toFixed(4)} ETH • ${(balances.BASE?.usdc || 0).toFixed(2)} USDC\n`;
      message += `*Celo:* ${(balances.CELO?.eth || 0).toFixed(4)} ETH • ${(balances.CELO?.usdc || 0).toFixed(2)} cUSD\n`;
    } else {
      message += `*Base:* 0.0000 ETH • 0.00 USDC\n`;
      message += `*Celo:* 0.0000 ETH • 0.00 cUSD\n`;
    }
  } else if (activeChain === "stellar" && stellarWallets.length > 0) {
    const idx = Math.min(activeWalletIndex, stellarWallets.length - 1);
    const wallet = stellarWallets[idx];
    const balances = stellarBalancesArray[idx];
    const isMain = idx === 0;
    const defaultBadge = isMain ? " 🟢 *(Default)*" : "";

    message += `*⭐ Stellar Wallet ${idx + 1}*\n`;
    message += `\`${wallet.address}\`${defaultBadge}\n\n`;

    if (balances) {
      message += `XLM: ${balances.xlm.toFixed(4)}   • USDC: ${balances.usdc.toFixed(2)}\n`;
    } else {
      message += `XLM: 0.0000   • USDC: 0.00\n`;
    }
  } else if (activeChain === "ton" && tonWallets.length > 0) {
    const idx = Math.min(activeWalletIndex, tonWallets.length - 1);
    const wallet = tonWallets[idx];
    const balances = tonBalancesArray[idx];
    const isMain = idx === 0;
    const defaultBadge = isMain ? " 🟢 *(Default)*" : "";

    message += `*💎 TON Wallet ${idx + 1}*\n`;
    message += `\`${wallet.address}\`${defaultBadge}\n\n`;

    if (balances) {
      message += `TON: ${balances.ton.toFixed(4)}   • USDT: ${balances.usdt.toFixed(2)}\n`;
    } else {
      message += `TON: 0.0000   • USDT: 0.00\n`;
    }
  } else {
    message += `No wallet found for ${activeChain.toUpperCase()}.\n`;
  }

  return message;
}

/**
 * Build wallet keyboard with Chain Tabs, Wallet Pills, and Contextual Actions
 */
export function buildWalletKeyboard(
  user: any,
  activeChain: ChainType = "solana",
  activeWalletIndex: number = 0
) {
  const solanaWallets = user.solanaWallets || [];
  const evmWallets = user.evmWallets || [];
  const stellarWallets = user.stellarWallets || [];
  const tonWallets = user.tonWallets || [];

  const keyboardButtons: any[] = [];

  // Row 1: Chain Switcher Tabs
  const chainTabButtons = [];
  if (solanaWallets.length > 0) {
    const activeLabel = activeChain === "solana" ? "Solana ✅" : "Solana";
    chainTabButtons.push(Markup.button.callback(activeLabel, "wallet_tab:solana:0"));
  }
  if (evmWallets.length > 0) {
    const activeLabel = activeChain === "evm" ? "EVM ✅" : "EVM";
    chainTabButtons.push(Markup.button.callback(activeLabel, "wallet_tab:evm:0"));
  }
  if (stellarWallets.length > 0) {
    const activeLabel = activeChain === "stellar" ? "Stellar ✅" : "Stellar";
    chainTabButtons.push(Markup.button.callback(activeLabel, "wallet_tab:stellar:0"));
  }
  if (tonWallets.length > 0) {
    const activeLabel = activeChain === "ton" ? "TON ✅" : "TON";
    chainTabButtons.push(Markup.button.callback(activeLabel, "wallet_tab:ton:0"));
  }
  if (chainTabButtons.length > 0) {
    keyboardButtons.push(chainTabButtons);
  }

  // Row 2: Wallet Selector Pills for active ✅ chain
  let currentWallets: any[] = [];
  if (activeChain === "solana") currentWallets = solanaWallets;
  else if (activeChain === "evm") currentWallets = evmWallets;
  else if (activeChain === "stellar") currentWallets = stellarWallets;
  else if (activeChain === "ton") currentWallets = tonWallets;

  if (currentWallets.length > 1) {
    const pillButtons = currentWallets.map((_, idx) => {
      const isSelected = idx === activeWalletIndex;
      const isMain = idx === 0;
      const chainTag =
        activeChain === "solana"
          ? "Sol"
          : activeChain === "evm"
          ? "EVM"
          : activeChain === "stellar"
          ? "Stellar"
          : "TON";
      const mainTag = isMain ? " (Default)" : "";
      const label = `${isSelected ? "✅ " : ""}${chainTag} ${idx + 1}${mainTag}`;
      return Markup.button.callback(label, `wallet_tab:${activeChain}:${idx}`);
    });

    keyboardButtons.push(pillButtons);
  }

  // Row 3: Action buttons for currently active wallet
  const actionRow: any[] = [];
  const isCurrentMain = activeWalletIndex === 0;

  // CONDITIONAL SET MAIN: Only show if NOT already main wallet
  if (!isCurrentMain && currentWallets.length > 1) {
    if (activeChain === "solana") {
      actionRow.push(Markup.button.callback("Set Default", `set_default_solana:${activeWalletIndex}`));
    } else if (activeChain === "evm") {
      actionRow.push(Markup.button.callback("Set Default", `set_default_evm:${activeWalletIndex}`));
    } else if (activeChain === "stellar") {
      actionRow.push(Markup.button.callback("Set Default", `set_default_stellar:${activeWalletIndex}`));
    } else if (activeChain === "ton") {
      actionRow.push(Markup.button.callback("Set Default", `set_default_ton:${activeWalletIndex}`));
    }
  }

  // Export Private Key button
  const exportPrefix = activeChain === "solana" ? "sol" : activeChain;
  actionRow.push(
    Markup.button.callback("🔑 Export Key", `select_export_${exportPrefix}:${activeWalletIndex}`)
  );

  // Delete Wallet button
  if (activeChain === "solana") {
    actionRow.push(Markup.button.callback("🚮 Delete", `delete_solana_wallet:${activeWalletIndex}`));
  } else if (activeChain === "evm") {
    actionRow.push(Markup.button.callback("🚮 Delete", `delete_evm_wallet:${activeWalletIndex}`));
  } else if (activeChain === "stellar") {
    actionRow.push(Markup.button.callback("🚮 Delete", `delete_stellar_wallet:${activeWalletIndex}`));
  } else if (activeChain === "ton") {
    actionRow.push(Markup.button.callback("🚮 Delete", `delete_ton_wallet:${activeWalletIndex}`));
  }

  if (actionRow.length > 0) {
    keyboardButtons.push(actionRow);
  }

  // Row 4: Global Menu Buttons
  keyboardButtons.push([
    Markup.button.callback("🔄 Refresh", `refresh_wallet:${activeChain}:${activeWalletIndex}`),
    Markup.button.callback("➕ Add Wallet", "add_wallet"),
    Markup.button.callback("🔙 Menu", "back_to_menu"),
  ]);

  return Markup.inlineKeyboard(keyboardButtons);
}

/**
 * Fetch balances and update wallet view in background
 */
async function fetchAndUpdateWalletBalances(
  ctx: Context,
  chatId: number,
  messageId: number,
  user: any,
  activeChain: ChainType = "solana",
  activeWalletIndex: number = 0,
  forceRefresh: boolean = false
): Promise<void> {
  try {
    const solanaWallets = user.solanaWallets || [];
    const evmWallets = user.evmWallets || [];
    const stellarWallets = user.stellarWallets || [];
    const tonWallets = user.tonWallets || [];

    const [solBalancesArray, evmBalancesArray, stellarBalancesArray, tonBalancesArray] = await Promise.all([
      Promise.all(solanaWallets.map((w: any) => getAllTokenBalances(w.address, forceRefresh))),
      Promise.all(evmWallets.map((w: any) => getAllEvmBalances(w.address, forceRefresh))),
      Promise.all(stellarWallets.map((w: any) => getStellarBalances(w.address, forceRefresh))),
      Promise.all(tonWallets.map((w: any) => getTonBalances(w.address, forceRefresh))),
    ]);

    const completeMessage = buildWalletComplete(
      user,
      solBalancesArray,
      evmBalancesArray,
      stellarBalancesArray,
      tonBalancesArray,
      activeChain,
      activeWalletIndex
    );

    const keyboard = buildWalletKeyboard(user, activeChain, activeWalletIndex);

    try {
      await ctx.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        completeMessage,
        {
          parse_mode: "Markdown",
          ...keyboard,
        }
      );
    } catch (error: any) {
      if (!error?.message?.includes("message is not modified")) {
        console.error("Failed to update wallet view:", error.message);
      }
    }
  } catch (error) {
    console.error("❌ Wallet balance fetch failed:", error);
  }
}

/**
 * Main handleViewWallet function
 */
export async function handleViewWallet(
  ctx: Context,
  requestedChain: ChainType = "solana",
  requestedWalletIndex: number = 0
): Promise<void> {
  try {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

    if (!telegramId) {
      await ctx.answerCbQuery?.("❌ Unable to identify your account.");
      return;
    }

    const user = await getUser(telegramId, username);

    if (!user) {
      await ctx.reply("❌ User not found. Please use /start to register first.");
      return;
    }

    const solanaWallets = user.solanaWallets || [];
    const evmWallets = user.evmWallets || [];
    const stellarWallets = user.stellarWallets || [];
    const tonWallets = user.tonWallets || [];
    const totalWallets = solanaWallets.length + evmWallets.length + stellarWallets.length + tonWallets.length;

    if (totalWallets === 0) {
      const noWalletMessage = `*Your Wallets*\n\nYou don't have any wallets yet.\n\nSet up a wallet to start trading!`;
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔑 Create Solana Wallet", "generate_wallet")],
        [Markup.button.callback("📥 Import Solana Wallet", "import_wallet")],
        [Markup.button.callback("🔙 Back to Menu", "back_to_menu")],
      ]);

      if (ctx.callbackQuery && 'message' in ctx.callbackQuery && ctx.callbackQuery.message) {
        await ctx.editMessageText(noWalletMessage, {
          parse_mode: "Markdown",
          ...keyboard,
        });
        await ctx.answerCbQuery?.("No wallets found");
      } else {
        await ctx.reply(noWalletMessage, {
          parse_mode: "Markdown",
          ...keyboard,
        });
      }
      return;
    }

    // Determine default active chain if requested chain is empty
    let activeChain = requestedChain;
    if (activeChain === "solana" && solanaWallets.length === 0) {
      if (evmWallets.length > 0) activeChain = "evm";
      else if (stellarWallets.length > 0) activeChain = "stellar";
      else if (tonWallets.length > 0) activeChain = "ton";
    } else if (activeChain === "evm" && evmWallets.length === 0) {
      if (solanaWallets.length > 0) activeChain = "solana";
      else if (stellarWallets.length > 0) activeChain = "stellar";
      else if (tonWallets.length > 0) activeChain = "ton";
    } else if (activeChain === "stellar" && stellarWallets.length === 0) {
      if (solanaWallets.length > 0) activeChain = "solana";
      else if (evmWallets.length > 0) activeChain = "evm";
      else if (tonWallets.length > 0) activeChain = "ton";
    } else if (activeChain === "ton" && tonWallets.length === 0) {
      if (solanaWallets.length > 0) activeChain = "solana";
      else if (evmWallets.length > 0) activeChain = "evm";
      else if (stellarWallets.length > 0) activeChain = "stellar";
    }

    const activeWalletIndex = Math.max(0, requestedWalletIndex);

    // Build skeleton message
    const skeletonMessage = buildWalletSkeleton(user, activeChain, activeWalletIndex);
    const keyboard = buildWalletKeyboard(user, activeChain, activeWalletIndex);

    let chatId: number;
    let messageId: number;

    if (ctx.callbackQuery && 'message' in ctx.callbackQuery && ctx.callbackQuery.message) {
      await ctx.editMessageText(skeletonMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
      chatId = ctx.callbackQuery.message.chat.id;
      messageId = ctx.callbackQuery.message.message_id;
      await ctx.answerCbQuery?.();
    } else {
      const sent = await ctx.reply(skeletonMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
      chatId = sent.chat.id;
      messageId = sent.message_id;
    }

    // Fetch balances in background
    fetchAndUpdateWalletBalances(
      ctx,
      chatId,
      messageId,
      user,
      activeChain,
      activeWalletIndex,
      false
    ).catch((error) => {
      console.error("Background wallet fetch error:", error);
    });
  } catch (error) {
    console.error("View wallet error:", error);
    await ctx.answerCbQuery?.("❌ Failed to load wallets.");
  }
}

/**
 * Handle tab switching callback: wallet_tab:chain:index
 */
export async function handleWalletTabSwitch(ctx: Context): Promise<void> {
  try {
    const cb = ctx.callbackQuery as any;
    if (!cb || !cb.data) return;

    const parts = cb.data.split(":");
    const chain = (parts[1] || "solana") as ChainType;
    const walletIndex = parseInt(parts[2] || "0", 10);

    await handleViewWallet(ctx, chain, walletIndex);
  } catch (error) {
    console.error("Wallet tab switch error:", error);
    await ctx.answerCbQuery?.("❌ Failed to switch tab.");
  }
}
