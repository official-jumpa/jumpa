import { Connection, PublicKey } from "@solana/web3.js";
import { Context, Markup } from "telegraf";
import { config } from "@core/config/environment";
import { setTradeState } from "@shared/state/tradeState";
import { randomBytes } from "crypto";

export async function generateTokenInfoMessage(contractAddress: string) {
  console.log("Generating token info for address:", contractAddress);

  // ✅ Validate token address on-chain
  const connection = new Connection(config.solMainnet);
  const mintPubkey = new PublicKey(contractAddress);

  const tokenInfo = await connection.getParsedAccountInfo(mintPubkey);
  if (!tokenInfo.value) {
    throw new Error("Invalid token address. Please enter a valid Solana token contract.");
  }

  // Check if the account has parsed mint data (indicates it's a token mint)
  const parsedData = (tokenInfo.value.data as any)?.parsed;
  if (!parsedData || parsedData.type !== "mint") {
    throw new Error("This address is not a token mint account.");
  }

  // ✅ Fetch token data from Jupiter Lite API
  const jupUrl = `https://lite-api.jup.ag/ultra/v1/search?query=${contractAddress}`;
  const response = await fetch(jupUrl);
  if (!response.ok) {
    console.log("Jup response:", response);
    if (response.status === 429) {
      throw new Error("RATE_LIMIT_ERROR");
    }
    throw new Error("Failed to fetch token data from Jupiter.");
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No token data found on Jupiter for this address.");
  }

  // Extract token info from Jupiter response
  const token = data[0];
  const {
    name,
    symbol,
    icon,
    decimals,
    usdPrice,
    fdv,
    mcap,
    liquidity,
    circSupply,
    stats24h,
    holderCount,
    audit,
  } = token;
  console.log("Token Info:", token)

  // Compute 24h stats safely
  const priceChange = stats24h?.priceChange ?? 0;
  const priceChangeString = priceChange > 0 ? `+${priceChange.toFixed(2)}` : priceChange.toFixed(2);
  const numTraders = stats24h?.numTraders ?? 0;
  const priceEmoji = priceChange > 0 ? "🟢" : "🔴";

  // 🧮 Build Telegram message for private chat
  const metricsMessage = `
<b>${name || "Unknown_Token"} (${symbol || "?"})</b>
${icon ? `<a href="${icon}">🖼️</a>` : ""}

<b>Contract:</b> <code>${contractAddress}</code>
<b>Verified:</b> ${token.isVerified ? "✅ Yes" : "❌ No"}
<b>Holders:</b> ${holderCount?.toLocaleString() ?? "N/A"}

💵 <b>Price:</b> ${usdPrice?.toFixed(6) ?? "N/A"}
📈 <b>24h Change:</b> ${priceChangeString}%
💧 <b>Liquidity:</b> ${liquidity ? liquidity.toLocaleString() : "N/A"}
🏦 <b>Market Cap:</b> ${mcap ? mcap.toLocaleString() : "N/A"}
💰 <b>FDV:</b> ${fdv ? fdv.toLocaleString() : "N/A"}
🧮 <b>Circulating Supply:</b> ${circSupply?.toLocaleString() ?? "N/A"}

Mint Authority Disabled: ${audit?.mintAuthorityDisabled ? "✅" : "❌"}
Freeze Authority Disabled: ${audit?.freezeAuthorityDisabled ? "✅" : "❌"}
24h Traders: ${numTraders?.toLocaleString() ?? "N/A"}
  `;

  // 🧮 Build Telegram message for group chat
  const groupMetricsMessage = `
<b>Group Trade</b>

<code>${contractAddress}</code>

<b>${name || "Unknown_Token"} (${symbol || "?"})</b>
${icon ? `<a href="${icon}">🖼️</a>` : ""}

<b>Verified:</b> ${token.isVerified ? "✅" : "❌"}
<b>Organic Score:</b> ${token.organicScoreLabel ? token.organicScoreLabel.toUpperCase() : "N/A"}

💵 <b>Price:</b> ${usdPrice?.toFixed(6) ?? "N/A"} USD
📈 <b>24h Change:</b>${priceEmoji} ${priceChangeString}%
💧 <b>Liquidity:</b> ${liquidity ? `$${liquidity.toLocaleString()}` : "N/A"}
🏦 <b>Mkt Cap:</b> ${mcap ? `$${mcap.toLocaleString()}` : "N/A"}
💰 <b>FDV:</b> ${fdv ? `$${fdv.toLocaleString()}` : "N/A"}

👥 <b>Holders:</b> ${holderCount?.toLocaleString() ?? "N/A"}
📊 <b>24h Traders:</b> ${numTraders?.toLocaleString() ?? "N/A"}

${token.twitter ? `<a href="${token.twitter}">Twitter</a>` : ""} || ${token.website ? `<a href="${token.website}">Website</a>` : ""} || ${token.discord ? `<a href="${token.discord}">Discord</a>` : ""}

━━━━━━━━━━━━━━
Select an option below to trade with the group token balance
`;


  const tradeId = randomBytes(8).toString("hex");
  setTradeState(tradeId, {
    contractAddress,
    symbol,
    decimals,
  });

  const privateChatOptions = Markup.inlineKeyboard([
    [
      Markup.button.callback("Buy 0.01 SOL", `buy:${tradeId}:0.01`),
      Markup.button.callback("Buy 0.05 SOL", `buy:${tradeId}:0.05`),
      Markup.button.callback("Buy 0.1 SOL", `buy:${tradeId}:0.1`),
    ],
    [
      Markup.button.callback("Buy 0.5 SOL", `buy:${tradeId}:0.5`),
      Markup.button.callback("Buy 1 SOL", `buy:${tradeId}:1`),
      Markup.button.callback("Buy 2 SOL", `buy:${tradeId}:2`),
    ],
    [Markup.button.callback("Buy X SOL", `buy_custom:${tradeId}`)],
    [
      Markup.button.callback("Sell 10%", `sell:${tradeId}:10`),
      Markup.button.callback("Sell 20%", `sell:${tradeId}:20`),
      Markup.button.callback("Sell 25%", `sell:${tradeId}:25`),
    ],
    [
      Markup.button.callback("Sell 50%", `sell:${tradeId}:50`),
      Markup.button.callback("Sell 75%", `sell:${tradeId}:75`),
      Markup.button.callback("Sell 100%", `sell:${tradeId}:100`),
    ],
    [
      Markup.button.callback("🔄 Refresh", `refresh:${contractAddress}`),
      Markup.button.url("📊 Chart", `https://dexscreener.com/solana/${contractAddress}`),
    ]
  ]);

  const groupChatOptions = Markup.inlineKeyboard([
    [
      Markup.button.callback("Buy 0.5 SOL", `groupBuy:${tradeId}:0.5`),
      Markup.button.callback("Buy 1 SOL", `groupBuy:${tradeId}:1`),
      Markup.button.callback("Buy 2 SOL", `groupBuy:${tradeId}:2`),
    ],
    [Markup.button.callback("Buy X SOL", `groupBuy_custom:${tradeId}`)],
    [
      Markup.button.callback("Sell 50%", `groupSell:${tradeId}:50`),
      Markup.button.callback("Sell 75%", `groupSell:${tradeId}:75`),
      Markup.button.callback("Sell 100%", `groupSell:${tradeId}:100`),
    ],
    [Markup.button.callback("Sell X SOL", `groupSell_custom:${tradeId}`)],

    [
      Markup.button.callback("🔄 Refresh", `refresh:${contractAddress}`),
      Markup.button.url("📊 Chart", `https://dexscreener.com/solana/${contractAddress}`),
    ]
  ]);

  return { metricsMessage, privateChatOptions, groupChatOptions, groupMetricsMessage };
}

export async function handleDetectToken(ctx: Context, contractAddress: string) {
  let loadingMsgId: number | undefined;

  try {
    // Send initial loading message
    const loadingMsg = await ctx.reply("⏳ Fetching token data...");
    loadingMsgId = loadingMsg.message_id;

    // Try to fetch token data
    let tokenData;
    try {
      tokenData = await generateTokenInfoMessage(contractAddress);
    } catch (firstError: any) {
      // Check if it's a rate limit error (429)
      if (firstError.message === "RATE_LIMIT_ERROR") {
        // Update message to show we're waiting
        try {
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            loadingMsgId,
            undefined,
            "⏳ Rate limit hit. Waiting 5 seconds before retrying..."
          );
        } catch (e) {
          // Ignore edit errors
        }

        // Wait 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Retry the request
        tokenData = await generateTokenInfoMessage(contractAddress);
      } else {
        // Not a rate limit error, rethrow
        throw firstError;
      }
    }

    // Success! Replace loading message with token data
    await ctx.telegram.editMessageText(
      ctx.chat!.id,
      loadingMsgId,
      undefined,
      tokenData.metricsMessage,
      { parse_mode: 'HTML', ...tokenData.privateChatOptions }
    );

  } catch (error: any) {
    console.error("Error in handleDetectToken:", error?.message || error);

    // Clean up loading message if it exists
    if (loadingMsgId) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsgId);
      } catch (e) {
        // Ignore delete errors
      }
    }

    // Show appropriate error message
    if (error.message?.includes("Invalid token address")) {
      await ctx.reply(`❌ ${error.message}`);
    } else if (error.message === "RATE_LIMIT_ERROR") {
      await ctx.reply(`❌ Jupiter API rate limit exceeded. Please try again in a minute.`);
    } else if (error.message?.includes("Failed to fetch token data from Jupiter")) {
      await ctx.reply(`❌ Jupiter API is unavailable. Please try again later.`);
    } else {
      await ctx.reply(`❌ ${error.message || "An unrecognized error occurred."}`);
    }
  }
}

export async function handleGroupToken(ctx: Context, contractAddress: string) {
  let loadingMsgId: number | undefined;

  try {
    // Send initial loading message (same as private chat)
    const loadingMsg = await ctx.reply("⏳ Fetching token data...");
    loadingMsgId = loadingMsg.message_id;

    // Try to fetch token data
    let tokenData;
    try {
      tokenData = await generateTokenInfoMessage(contractAddress);
    } catch (firstError: any) {
      // Check if it's a rate limit error
      if (firstError.message === "RATE_LIMIT_ERROR") {
        // Update message (same as private chat)
        try {
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            loadingMsgId,
            undefined,
            "⏳ Rate limit hit. Waiting 5 seconds before retrying..."
          );
        } catch (e) {
          // Ignore edit errors
        }

        // Wait 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Retry the request
        tokenData = await generateTokenInfoMessage(contractAddress);
      } else {
        throw firstError;
      }
    }

    // Success! Replace with token data
    await ctx.telegram.editMessageText(
      ctx.chat!.id,
      loadingMsgId,
      undefined,
      tokenData.groupMetricsMessage,
      { parse_mode: 'HTML', ...tokenData.groupChatOptions }
    );

  } catch (error: any) {
    console.error("Error in handleGroupToken:", error?.message || error);

    // Clean up loading message
    if (loadingMsgId) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsgId);
      } catch (e) {
        // Ignore
      }
    }

    // Show error (same as private chat)
    if (error.message?.includes("Invalid token address")) {
      await ctx.reply(`❌ ${error.message}`);
    } else if (error.message === "RATE_LIMIT_ERROR") {
      await ctx.reply(`❌ Jupiter API rate limit exceeded. Please try again in a minute.`);
    } else if (error.message?.includes("Failed to fetch token data from Jupiter")) {
      await ctx.reply(`❌ Jupiter API is unavailable. Please try again later.`);
    } else {
      await ctx.reply(`❌ ${error.message || "An unrecognized error occurred."}`);
    }
  }
}