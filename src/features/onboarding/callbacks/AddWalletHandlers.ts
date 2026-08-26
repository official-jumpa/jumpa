import { Context } from "telegraf";
import getUser, {
  addSolanaWalletToUser,
  addEVMWalletToUser,
  addStellarWalletToUser,
  addTonWalletToUser,
} from "@features/users/getUserInfo";
import { Markup } from "telegraf";
import { encryptPrivateKey } from "@shared/utils/encryption";
import { Keypair } from "@solana/web3.js";
import { Wallet } from "ethers";
import { Keypair as StellarKeypair, StrKey } from "@stellar/stellar-sdk";
import createNewStellarWallet from "@shared/utils/createStellarWallet";
import createNewTonWallet, {
  deriveTonWalletFromMnemonic,
  deriveTonWalletFromPrivateKey,
} from "@shared/utils/createTonWallet";
import {
  setUserActionState,
  clearUserActionState,
} from "@shared/state";
import bs58 from "bs58";
import { sendOrEdit } from "@shared/utils/messageHelper";

interface GeneratedEvmWallet {
  success: boolean;
  newAddress?: string;
  newPrivateKey?: string;
}

// Generate random EVM wallet helper
function createRandomEvmWallet(): GeneratedEvmWallet {
  try {
    const wallet = Wallet.createRandom();
    return {
      success: true,
      newAddress: wallet.address,
      newPrivateKey: wallet.privateKey,
    };
  } catch (error) {
    console.error("Failed to generate EVM wallet:", error);
    return { success: false };
  }
}

// Handle add wallet callback
export async function handleAddWallet(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.answerCbQuery("❌ Unable to identify your account.");
      return;
    }

    await ctx.answerCbQuery("➕ Add Wallet");

    const message = `➕ **Add Wallet**

Choose the wallet type you want to add: Solana, Stellar, TON, or EVM (Base, Celo, Polygon, Arbitrum). If you don't have an existing wallet, generate one using the buttons below.`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback("Solana", "add_wallet_solana"),
        Markup.button.callback("EVM", "add_wallet_evm"),
      ],
      [
        Markup.button.callback("Stellar", "add_wallet_stellar"),
        Markup.button.callback("TON (Gram)", "add_wallet_ton"),
      ],
      [
        Markup.button.callback("Generate EVM", "generate_evm_wallet"),
        Markup.button.callback("Generate Stellar", "generate_stellar_wallet"),
      ],
      [
        Markup.button.callback("💎 Generate TON", "generate_ton_wallet"),
      ],
      [Markup.button.callback("🔙 Back", "view_wallet")],
    ]);

    await sendOrEdit(ctx, message, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    console.error("Add wallet error:", error);
    await ctx.answerCbQuery("❌ Failed to show wallet options.");
    await ctx.reply("❌ An error occurred. Please try again.");
  }
}

// Handle add Solana wallet callback
export async function handleAddSolanaWallet(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.answerCbQuery("❌ Unable to identify your account.");
      return;
    }

    await ctx.answerCbQuery("🟣 Add Solana Wallet");

    // Get user to check if wallet already exists
    const user = await getUser(
      telegramId,
      ctx.from?.username || ctx.from?.first_name || "Unknown"
    );
    if (!user) {
      await ctx.reply(
        "❌ User not found. Please use /start to register first."
      );
      return;
    }

    // Check wallet limit
    if (user.solanaWallets.length >= 3) {
      await ctx.reply(
        "❌ You have reached the maximum limit of 3 Solana wallets."
      );
      return;
    }

    // Set state to await private key
    setUserActionState(telegramId, {
      action: "awaiting_add_solana_private_key",
    });

    const importMessage = `📥 **Add Solana Wallet**

Paste your Solana private key (base58 or hex format).

⚠️ **Note:**
- Your private key will be stored securely.
- Never share your private key with anyone
- This wallet will be added to your existing wallets
`;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🏠 Go Back", "back_to_menu")],
    ]);
    await sendOrEdit(ctx, importMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    console.error("Add Solana wallet error:", error);
    await ctx.answerCbQuery("❌ Failed to start add wallet process.");
    await ctx.reply("❌ An error occurred. Please try again.");
  }
}

// Handle add EVM wallet callback
export async function handleAddEVMWallet(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.answerCbQuery("❌ Unable to identify your account.");
      return;
    }

    await ctx.answerCbQuery("🔵 Add EVM Wallet");

    // Get user to check if wallet already exists
    const user = await getUser(
      telegramId,
      ctx.from?.username || ctx.from?.first_name || "Unknown"
    );
    if (!user) {
      await ctx.reply(
        "❌ User not found. Please use /start to register first."
      );
      return;
    }

    // Check wallet limit
    if (user.evmWallets.length >= 3) {
      await ctx.reply(
        "❌ You have reached the maximum limit of 3 EVM wallets."
      );
      return;
    }

    // Set state to await private key
    setUserActionState(telegramId, {
      action: "awaiting_add_evm_private_key",
    });

    const importMessage = `📥 **Add EVM Wallet**

Paste your EVM private key (hex format, with or without 0x prefix).

⚠️ **Note:**
- Your private key will be stored securely.
- Never share your private key with anyone
- This wallet will be added to your existing wallets
- Works with Base, Celo, Lisk, and any other EVM-compatible chains
`;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🏠 Go Back", "back_to_menu")],
    ]);

    await sendOrEdit(ctx, importMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    console.error("Add EVM wallet error:", error);
    await ctx.answerCbQuery("❌ Failed to start add wallet process.");
    await ctx.reply("❌ An error occurred. Please try again.");
  }
}

// Handle add EVM private key input
export async function handleAddEVMPrivateKeyInput(
  ctx: Context,
  privateKeyInput: string
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply("❌ Unable to identify your account.");
    return;
  }

  try {
    // Clear the state
    clearUserActionState(telegramId);

    // Clean the input (remove whitespace and 0x prefix if present)
    let privateKeyInputClean = privateKeyInput.trim();

    // Remove 0x prefix if present
    if (
      privateKeyInputClean.startsWith("0x") ||
      privateKeyInputClean.startsWith("0X")
    ) {
      privateKeyInputClean = privateKeyInputClean.slice(2);
    }

    // Validate private key format (should be 64 hex characters = 32 bytes)
    if (!/^[0-9a-fA-F]{64}$/.test(privateKeyInputClean)) {
      await ctx.reply(
        "❌ Invalid private key format. Please provide a valid 64-character hexadecimal private key (with or without 0x prefix)."
      );
      return;
    }

    // Validate and create wallet from private key using ethers.js v6
    let wallet: Wallet;
    try {
      // Add 0x prefix for ethers.js
      const privateKeyWithPrefix = "0x" + privateKeyInputClean;
      wallet = new Wallet(privateKeyWithPrefix);
    } catch (error) {
      await ctx.reply("❌ Invalid private key. Please check and try again.");
      return;
    }

    const walletAddress = wallet.address;

    // Check if wallet already exists in user's wallets
    const user = await getUser(
      telegramId,
      ctx.from?.username || ctx.from?.first_name || "Unknown"
    );
    if (!user) {
      await ctx.reply("❌ User not found.");
      return;
    }

    const existingWallet = user.evmWallets.find(
      (w) => w.address.toLowerCase() === walletAddress.toLowerCase()
    );
    if (existingWallet) {
      await ctx.reply("⚠️ This wallet is already added to your account.");
      return;
    }

    // Encrypt private key (ethers private keys are already hex format)
    const encryptedPrivateKey = encryptPrivateKey(privateKeyInputClean);

    // Add wallet to user
    await addEVMWalletToUser(telegramId, walletAddress, encryptedPrivateKey);

    const successMessage = `✅ **EVM Wallet Added Successfully!**

📍 **Wallet Address:**
\`${walletAddress}\`

Your EVM wallet has been added to your account!

This wallet works on all EVM-compatible chains:
• Ethereum
• Base
• Celo
• Lisk
• Polygon
• And more...`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Back to Wallets", "view_wallet")],
    ]);

    await sendOrEdit(ctx, successMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    console.error("Add EVM private key error:", error);
    clearUserActionState(telegramId);

    // Handle specific error cases
    if (error instanceof Error && error.message === "Wallet already exists") {
      await ctx.reply("⚠️ This wallet is already added to your account.");
    } else {
      await ctx.reply(
        "❌ An error occurred while adding your wallet. Please try again."
      );
    }
  }
}

// Handle add Solana private key input
export async function handleAddSolanaPrivateKeyInput(
  ctx: Context,
  privateKeyInput: string
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply("❌ Unable to identify your account.");
    return;
  }

  try {
    // Clear the state
    clearUserActionState(telegramId);

    // Clean the input (remove whitespace)
    const privateKeyInputClean = privateKeyInput.trim();

    // Decode private key and validate - support both base58 and hex formats
    let secretKey: Uint8Array;
    try {
      // Try base58 format first
      if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(privateKeyInputClean)) {
        secretKey = bs58.decode(privateKeyInputClean);
      } else if (/^[0-9a-fA-F]+$/.test(privateKeyInputClean)) {
        const buffer = Buffer.from(privateKeyInputClean, "hex");
        secretKey = new Uint8Array(buffer);
      } else {
        throw new Error(
          "Invalid format. Expected base58 or hexadecimal string."
        );
      }

      if (secretKey.length !== 64 && secretKey.length !== 32) {
        throw new Error(
          `Invalid private key length. Expected 32 or 64 bytes, got ${secretKey.length}.`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await ctx.reply(
        `❌ Invalid private key format. ${errorMessage} Please provide a valid base58 or hex encoded private key.`
      );
      return;
    }

    // Validate and create keypair from private key
    let keypair: Keypair;
    try {
      keypair = Keypair.fromSecretKey(secretKey);
    } catch (error) {
      await ctx.reply("❌ Invalid private key. Please check and try again.");
      return;
    }

    const walletAddress = keypair.publicKey.toString();

    // Check if wallet already exists in user's wallets
    const user = await getUser(
      telegramId,
      ctx.from?.username || ctx.from?.first_name || "Unknown"
    );
    if (!user) {
      await ctx.reply("❌ User not found.");
      return;
    }

    const existingWallet = user.solanaWallets.find(
      (w) => w.address === walletAddress
    );
    if (existingWallet) {
      await ctx.reply("⚠️ This wallet is already added to your account.");
      return;
    }

    // Convert secret key to hex for encryption
    const privateKeyHex = Buffer.from(secretKey).toString("hex");

    // Encrypt private key
    const encryptedPrivateKey = encryptPrivateKey(privateKeyHex);

    // Add wallet to user
    await addSolanaWalletToUser(
      telegramId,
      walletAddress,
      encryptedPrivateKey
    );

    const successMessage = `✅ **Wallet Added Successfully!**

📍 **Wallet Address:**
\`${walletAddress}\`

Your wallet has been added to your account!`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Back to Wallets", "view_wallet")],
    ]);

    await sendOrEdit(ctx, successMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    console.error("Add Solana private key error:", error);
    clearUserActionState(telegramId);

    if (error instanceof Error && error.message === "Wallet already exists") {
      await ctx.reply("⚠️ This wallet is already added to your account.");
    } else {
      await ctx.reply(
        "❌ An error occurred while adding your wallet. Please try again."
      );
    }
  }
}

// Handle generate EVM wallet callback
export async function handleGenerateEVMWallet(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.answerCbQuery("❌ Unable to identify your account.");
      return;
    }

    await ctx.answerCbQuery("🔵 Generating New EVM Wallet...");

    const user = await getUser(
      telegramId,
      ctx.from?.username || ctx.from?.first_name || "Unknown"
    );

    if (!user) {
      await ctx.reply(
        "❌ User not found. Please use /start to register first."
      );
      return;
    }

    if (user.evmWallets.length >= 3) {
      await ctx.reply(
        "❌ You have reached the maximum limit of 3 EVM wallets."
      );
      return;
    }

    const newWallet = createRandomEvmWallet();

    if (newWallet && newWallet.success && newWallet.newPrivateKey && newWallet.newAddress) {
      const pKeyWithout0x = newWallet.newPrivateKey.startsWith("0x")
        ? newWallet.newPrivateKey.slice(2)
        : newWallet.newPrivateKey;

      const encryptedPrivateKey = encryptPrivateKey(pKeyWithout0x);
      await addEVMWalletToUser(
        telegramId,
        newWallet.newAddress,
        encryptedPrivateKey
      );

      const replyMessage = `📥 **Generate New EVM Wallet**

A new wallet has been generated for you and can be used for trade and P2P transactions.

**Address:** \`${newWallet.newAddress}\`
`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back", "view_wallet")],
      ]);

      await sendOrEdit(ctx, replyMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } else {
      await ctx.reply(
        "❌ Failed to generate a new EVM wallet. Please try again later."
      );
    }
  } catch (error) {
    console.error("Wallet generation error:", error);
    await ctx.reply(
      "⚠️ An unexpected error occurred while generating your wallet. Please try again."
    );
  }
}

// Handle add Stellar wallet callback
export async function handleAddStellarWallet(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.answerCbQuery("❌ invalid account.");
      return;
    }

    await ctx.answerCbQuery("⭐ Add Stellar Wallet");

    const user = await getUser(
      telegramId,
      ctx.from?.username || ctx.from?.first_name || "Unknown"
    );
    if (!user) {
      await ctx.reply("❌ User not found. Please use /start to register first.");
      return;
    }

    if (user.stellarWallets && user.stellarWallets.length >= 3) {
      await ctx.reply("❌ You have reached the maximum limit of 3 Stellar wallets.");
      return;
    }

    setUserActionState(telegramId, {
      action: "awaiting_add_stellar_private_key",
    });

    const message = `**Import Stellar Wallet**

Reply with your Stellar Secret Key (starts with \`S\`) or private key seed hex.

⚠️ **To keep your wallet safe:**
• Make sure no one is watching your screen
• Delete your message after sending it

Type /cancel to cancel this operation.`;

    await ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Add Stellar wallet error:", error);
    await ctx.answerCbQuery("❌ Failed to initiate Stellar wallet import.");
    await ctx.reply("❌ An error occurred. Please try again.");
  }
}

// Handle Stellar private key input from user text message
export async function handleAddStellarPrivateKeyInput(
  ctx: Context,
  privateKeyInput: string
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    const cleanKey = privateKeyInput.trim();
    let stellarKeypair: StellarKeypair;

    if (StrKey.isValidEd25519SecretSeed(cleanKey)) {
      stellarKeypair = StellarKeypair.fromSecret(cleanKey);
    } else {
      try {
        const rawBuffer = Buffer.from(cleanKey.replace(/^0x/, ""), "hex");
        if (rawBuffer.length === 32) {
          stellarKeypair = StellarKeypair.fromRawEd25519Seed(rawBuffer);
        } else {
          throw new Error("Invalid key length");
        }
      } catch {
        await ctx.reply("❌ Invalid Stellar secret key. Please enter a valid key starting with 'S' or a 32-byte hex seed.");
        clearUserActionState(telegramId);
        return;
      }
    }

    const walletAddress = stellarKeypair.publicKey();
    const rawSecretHex = Buffer.from(stellarKeypair.rawSecretKey()).toString("hex");
    const encryptedPrivateKey = encryptPrivateKey(rawSecretHex);

    await addStellarWalletToUser(telegramId, walletAddress, encryptedPrivateKey);
    clearUserActionState(telegramId);

    const successMessage = `✅ **Stellar Wallet Added Successfully!**

📍 **Wallet Address:**
\`${walletAddress}\`

Your Stellar wallet has been added to your account!`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Back to Wallets", "view_wallet")],
    ]);

    await sendOrEdit(ctx, successMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    console.error("Add Stellar private key error:", error);
    clearUserActionState(telegramId);

    if (error instanceof Error && error.message === "Wallet already exists") {
      await ctx.reply("⚠️ This Stellar wallet is already added to your account.");
    } else {
      await ctx.reply("❌ An error occurred while adding your Stellar wallet. Please try again.");
    }
  }
}

// Handle generate Stellar wallet callback
export async function handleGenerateStellarWallet(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.answerCbQuery("❌ Unable to identify your account.");
      return;
    }

    await ctx.answerCbQuery("⭐ Generating New Stellar Wallet...");

    const user = await getUser(
      telegramId,
      ctx.from?.username || ctx.from?.first_name || "Unknown"
    );

    if (!user) {
      await ctx.reply("❌ User not found. Please use /start to register first.");
      return;
    }

    if (user.stellarWallets && user.stellarWallets.length >= 3) {
      await ctx.reply("❌ You have reached the maximum limit of 3 Stellar wallets.");
      return;
    }

    const newWallet = await createNewStellarWallet(telegramId);

    await addStellarWalletToUser(
      telegramId,
      newWallet.address,
      newWallet.private_key_encrypted
    );

    const replyMessage = `
Here's your new Stellar Wallet

**Address:** \`${newWallet.address}\`

⚠️ **Private Key:**
\`${newWallet.private_key}\`

🔐 *Never share your secret key with anyone. Delete this message after backing up your wallet. You can always export your private key anytime*
`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Back", "view_wallet")],
    ]);

    await sendOrEdit(ctx, replyMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    console.error("Stellar wallet generation error:", error);
    await ctx.reply("⚠️ An unexpected error occurred while generating your Stellar wallet.");
  }
}

// Handle add TON wallet callback
export async function handleAddTonWallet(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.answerCbQuery("❌ Invalid account.");
      return;
    }

    await ctx.answerCbQuery("💎 Add TON Wallet");

    const user = await getUser(
      telegramId,
      ctx.from?.username || ctx.from?.first_name || "Unknown"
    );
    if (!user) {
      await ctx.reply("❌ User not found. Please use /start to register first.");
      return;
    }

    if (user.tonWallets && user.tonWallets.length >= 3) {
      await ctx.reply("❌ You have reached the maximum limit of 3 TON wallets.");
      return;
    }

    setUserActionState(telegramId, {
      action: "awaiting_add_ton_private_key",
    });

    const message = `**Import TON Wallet**

Reply with your **24-word recovery phrase** or your **64/128-character private key hex**.

⚠️ **To keep your wallet safe:**
• Make sure no one is watching your screen
• Delete your message after sending it

Type /cancel to cancel this operation.`;

    await ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Add TON wallet error:", error);
    await ctx.answerCbQuery("❌ Failed to initiate TON wallet import.");
    await ctx.reply("❌ An error occurred. Please try again.");
  }
}

// Handle TON private key or mnemonic input from user text message
export async function handleAddTonPrivateKeyInput(
  ctx: Context,
  input: string
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    const cleanInput = input.trim();
    let tonWalletData: {
      address: string;
      rawAddress: string;
      encryptedPrivateKey: string;
      encryptedMnemonic?: string;
      version: string;
    };

    // Check if input is a 24-word mnemonic (or 12-word)
    const words = cleanInput.split(/\s+/);
    if (words.length === 24 || words.length === 12) {
      const derived = await deriveTonWalletFromMnemonic(words);
      tonWalletData = {
        address: derived.address,
        rawAddress: derived.rawAddress,
        encryptedPrivateKey: derived.encryptedPrivateKey,
        encryptedMnemonic: derived.encryptedMnemonic,
        version: derived.version,
      };
    } else {
      // Hex private key format
      const hexKey = cleanInput.replace(/^0x/, "");
      if (!/^[0-9a-fA-F]{64}$/.test(hexKey) && !/^[0-9a-fA-F]{128}$/.test(hexKey)) {
        await ctx.reply("❌ Invalid format. Please provide a valid 24-word recovery phrase or hex private key.");
        clearUserActionState(telegramId);
        return;
      }

      const derived = deriveTonWalletFromPrivateKey(hexKey);
      tonWalletData = {
        address: derived.address,
        rawAddress: derived.rawAddress,
        encryptedPrivateKey: derived.encryptedPrivateKey,
        version: derived.version,
      };
    }

    const user = await getUser(
      telegramId,
      ctx.from?.username || ctx.from?.first_name || "Unknown"
    );
    if (!user) {
      await ctx.reply("❌ User not found.");
      clearUserActionState(telegramId);
      return;
    }

    const existingWallet = user.tonWallets?.find(
      (w) => w.address === tonWalletData.address || w.rawAddress === tonWalletData.rawAddress
    );
    if (existingWallet) {
      await ctx.reply("⚠️ This TON wallet is already added to your account.");
      clearUserActionState(telegramId);
      return;
    }

    await addTonWalletToUser(
      telegramId,
      tonWalletData.address,
      tonWalletData.encryptedPrivateKey,
      tonWalletData.encryptedMnemonic,
      tonWalletData.rawAddress,
      tonWalletData.version
    );

    clearUserActionState(telegramId);

    const successMessage = `✅ **TON Wallet Added Successfully!**

📍 **Wallet Address:**
\`${tonWalletData.address}\`

Your TON wallet has been added to your account!`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Back to Wallets", "view_wallet")],
    ]);

    await sendOrEdit(ctx, successMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    console.error("Add TON private key error:", error);
    clearUserActionState(telegramId);

    if (error instanceof Error && error.message === "Wallet already exists") {
      await ctx.reply("⚠️ This TON wallet is already added to your account.");
    } else {
      await ctx.reply("❌ An error occurred while adding your TON wallet. Please try again.");
    }
  }
}

// Handle generate TON wallet callback
export async function handleGenerateTonWallet(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.answerCbQuery("❌ Unable to identify your account.");
      return;
    }

    await ctx.answerCbQuery("💎 Generating New TON Wallet...");

    const user = await getUser(
      telegramId,
      ctx.from?.username || ctx.from?.first_name || "Unknown"
    );

    if (!user) {
      await ctx.reply("❌ User not found. Please use /start to register first.");
      return;
    }

    if (user.tonWallets && user.tonWallets.length >= 3) {
      await ctx.reply("❌ You have reached the maximum limit of 3 TON wallets.");
      return;
    }

    const newWallet = await createNewTonWallet(telegramId);

    await addTonWalletToUser(
      telegramId,
      newWallet.address,
      newWallet.private_key_encrypted,
      newWallet.mnemonic_encrypted,
      newWallet.rawAddress,
      newWallet.version
    );

    const replyMessage = `
💎 **Here's your new TON (Gram) Wallet**

**Address (Non-bounceable):**
\`${newWallet.address}\`

📝 **24-Word Recovery Phrase:**
\`${newWallet.mnemonic}\`

⚠️ **Private Key (Hex):**
\`${newWallet.private_key}\`

🔐 *Never share your recovery phrase or secret key with anyone. Delete this message after backing up your wallet. You can export your credentials anytime.*
`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Back", "view_wallet")],
    ]);

    await sendOrEdit(ctx, replyMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    console.error("TON wallet generation error:", error);
    await ctx.reply("⚠️ An unexpected error occurred while generating your TON wallet.");
  }
}
