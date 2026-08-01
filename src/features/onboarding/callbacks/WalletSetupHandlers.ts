import { Context } from "telegraf";
import getUser, { addSolanaWalletToUser } from "@features/users/getUserInfo";
import { Markup } from "telegraf";
import createNewSolanaWallet from "@shared/utils/createWallet";
import { encryptPrivateKey } from "@shared/utils/encryption";
import { Keypair } from "@solana/web3.js";
import {
  setUserActionState,
  clearUserActionState,
} from "@shared/state";
import bs58 from "bs58";
import { sendOrEdit } from "@shared/utils/messageHelper";

// Handle generate wallet callback
export async function handleGenerateWallet(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

    if (!telegramId) {
      await ctx.answerCbQuery("❌ Unable to identify your account.");
      return;
    }

    await ctx.answerCbQuery("🔑 Generating wallet...");

    const user = await getUser(telegramId, username);
    if (!user) {
      await ctx.reply(
        "❌ User not found. Please use /start to register first."
      );
      return;
    }

    const hasSolanaWallet =
      user.solanaWallets &&
      user.solanaWallets.length > 0 &&
      user.solanaWallets[0].address;

    if (hasSolanaWallet) {
      await ctx.reply("✅ You already have a wallet set up!");
      return;
    }

    const newWallet = await createNewSolanaWallet(telegramId);

    await addSolanaWalletToUser(
      telegramId,
      newWallet.address,
      newWallet.private_key_encrypted
    );

    const successMessage = `✅ **Wallet created Successfully!**

📍 **Your Wallet Address:**
\`${newWallet.address}\`

⚠️ **Important:** Save your private key securely. You'll need it to access your wallet:

\`${newWallet.private_key}\`

🔐 **Security Warning:**
- Never share your private key with anyone
- Store it in a safe place
- You can export your wallet later from the wallet menu

Ready to start trading!`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🏠 Back to Main Menu", "back_to_menu")],
    ]);

    await sendOrEdit(ctx, successMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    console.error("Generate wallet error:", error);
    await ctx.answerCbQuery("❌ Failed to generate wallet.");
    await sendOrEdit(
      ctx,
      "❌ An error occurred while creating your wallet. Please try again."
    );
  }
}

// Handle import wallet callback
export async function handleImportWallet(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.answerCbQuery("❌ Unable to identify your account.");
      return;
    }

    await ctx.answerCbQuery("📥 Import wallet");

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

    const hasSolanaWallet =
      user.solanaWallets &&
      user.solanaWallets.length > 0 &&
      user.solanaWallets[0].address;

    if (hasSolanaWallet) {
      await ctx.reply("✅ You already have a wallet set up!");
      return;
    }

    setUserActionState(telegramId, {
      action: "awaiting_import_private_key",
    });

    const importMessage = `📥 **Import Existing Wallet**

Paste your Solana private key (base58 or hex format).

⚠️ **Note:**
- Your private key will be encrypted and stored securely.
- Never share your private key with anyone
`;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🏠 Go Back", "back_to_menu")],
    ]);

    await sendOrEdit(ctx, importMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    console.error("Import wallet error:", error);
    await ctx.answerCbQuery("❌ Failed to start import process.");
    await ctx.reply("❌ An error occurred. Please try again.");
  }
}

// Handle private key import
export async function handlePrivateKeyImport(
  ctx: Context,
  privateKeyInput: string
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply("❌ Unable to identify your account.");
    return;
  }

  try {
    clearUserActionState(telegramId);

    const privateKeyInputClean = privateKeyInput.trim();

    let secretKey: Uint8Array;
    try {
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

    let keypair: Keypair;
    try {
      keypair = Keypair.fromSecretKey(secretKey);
    } catch (error) {
      await ctx.reply("❌ Invalid private key. Please check and try again.");
      return;
    }

    const walletAddress = keypair.publicKey.toString();

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
      await ctx.reply("⚠️ This wallet is already imported.");
      return;
    }

    const privateKeyHex = Buffer.from(secretKey).toString("hex");
    const encryptedPrivateKey = encryptPrivateKey(privateKeyHex);

    await addSolanaWalletToUser(
      telegramId,
      walletAddress,
      encryptedPrivateKey
    );

    const successMessage = `✅ **Wallet Imported Successfully!**

📍 **Your Wallet Address:**
\`${walletAddress}\`

Ready to start trading!`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🏠 Back to Main Menu", "back_to_menu")],
    ]);

    await sendOrEdit(ctx, successMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    console.error("Private key import error:", error);
    clearUserActionState(telegramId);
    await ctx.reply(
      "❌ An error occurred while importing your wallet. Please try again."
    );
  }
}
