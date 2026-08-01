import {
  setBankUpdateState,
  getBankUpdateState,
  clearBankUpdateState,
} from "@shared/state";
import getUser from "@features/users/getUserInfo";
import { Context, Markup } from "telegraf";
import { sendOrEdit } from "@shared/utils/messageHelper";

// Module-level constant for supported banks dataset
export const SUPPORTED_NIGERIAN_BANKS = [
  { Name: "Opay", Code: "100004" },
  { Name: "Guaranty Trust Bank", Code: "058" },
  { Name: "Access Bank", Code: "044" },
  { Name: "First Bank PLC", Code: "011" },
  { Name: "Zenith Bank PLC", Code: "057" },
  { Name: "United Bank for Africa", Code: "033" },
  { Name: "Union Bank PLC", Code: "032" },
  { Name: "EcoBank PLC", Code: "050" },
  { Name: "Fidelity Bank", Code: "070" },
  { Name: "Stanbic IBTC Bank", Code: "221" },
  { Name: "First City Monument Bank (FCMB)", Code: "214" },
  { Name: "Wema Bank PLC", Code: "035" },
  { Name: "Polaris Bank", Code: "076" },
  { Name: "Keystone Bank", Code: "082" },
  { Name: "Sterling Bank PLC", Code: "232" },
  { Name: "ProvidusBank PLC", Code: "101" },
  { Name: "Kuda", Code: "090267" },
  { Name: "Moniepoint Microfinance Bank", Code: "090405" },
  { Name: "Paga", Code: "327" },
  { Name: "Unity Bank PLC", Code: "215" },
  { Name: "Jaiz Bank", Code: "301" },
  { Name: "Titan Trust Bank", Code: "000025" },
  { Name: "AccessMobile", Code: "100013" },
  { Name: "GTBank (Guaranty) Mobile", Code: "100009" },
  { Name: "FCMB Easy Account", Code: "100031" },
];

export async function handleGetBankAccount(ctx: Context): Promise<void> {
  await ctx.answerCbQuery("🏠 Getting Bank Account");

  try {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

    if (!userId || !chatId) {
      await ctx.reply("❌ Unable to identify user or chat.");
      return;
    }

    try {
      const usrInfo = await getUser(userId, username);
      if (!usrInfo) {
        await ctx.reply(
          "❌ User not found. Please use /start to register first."
        );
        return;
      } else if (
        !usrInfo.bank_details.account_name ||
        !usrInfo.bank_details.account_number ||
        !usrInfo.bank_details.bank_name
      ) {
        const createMessage = `
❌ No bank account found. Please set up your bank account below.
              `;

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback("🔑 Add Bank Name", "update_bank_name")],
          [
            Markup.button.callback(
              "ℹ️ Add Account Name",
              "update_account_name"
            ),
            Markup.button.callback(
              "❓Add Account Number",
              "update_account_number"
            ),
          ],
          [Markup.button.callback("❌ Cancel", "delete_message")],
        ]);
        await sendOrEdit(ctx, createMessage, {
          parse_mode: "Markdown",
          ...keyboard,
        });
        return;
      }

      const createMessage = `
<b>YOUR BANK DETAILS</b>        

<b>Bank Name:</b> ${usrInfo.bank_details.bank_name}
<b>Account Number:</b> ${usrInfo.bank_details.account_number}
<b>Account Name:</b> ${usrInfo.bank_details.account_name.toUpperCase()}       
            `;
      const sentMessage = await ctx.reply(createMessage, {
        parse_mode: "HTML",
      });

      setTimeout(() => {
        ctx.deleteMessage(sentMessage.message_id);
      }, 30000);
    } catch (error) {
      console.error("Error retrieving user info:", error);
      await ctx.reply(
        "❌ An error occurred while retrieving your bank account."
      );
      return;
    }
  } catch (error) {
    console.error("Create error:", error);
    await ctx.answerCbQuery("❌ Failed to create.");
  }
}

export async function handleUpdateBankName(ctx: Context): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("❌ Unable to identify user.");
      return;
    }

    const cbData =
      (ctx.callbackQuery && (ctx.callbackQuery as any).data) || null;

    if (cbData && typeof cbData === "string") {
      if (cbData === "update_bank_name") {
        setBankUpdateState(userId, "awaiting_bank_name");
        const createMessage = `
Choose from a list of the supported banks below.

<b>Supported Banks:</b>

${SUPPORTED_NIGERIAN_BANKS
  .map(
    (bank, index) =>
      `<b>${(index + 1).toString().padStart(2, "0")}. ${bank.Name}</b>`
  )
  .join("\n")}
Reply with the bank id to select it. For eg: reply with 0️⃣1️⃣ to select Opay.
                `;
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback("❌ Cancel", "delete_message")],
        ]);
        await ctx.reply(createMessage, { parse_mode: "HTML", ...keyboard });
        return;
      }
    }
  } catch (error) {
    console.error("Create error:", error);
    await ctx.answerCbQuery("❌ Failed to open create.");
  }
}

export async function handleFinalConfirmation(ctx: Context): Promise<void> {
  const cbData =
    (ctx.callbackQuery && (ctx.callbackQuery as any).data) || null;
  if (!cbData || typeof cbData !== "string") return;

  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("❌ Unable to identify user.");
    return;
  }

  if (cbData === "final_confirmation:confirm") {
    const state = getBankUpdateState(userId);
    if (state && state.step === "awaiting_final_confirmation") {
      const { bankName, bankCode, accountName, accountNumber } = state.data;
      const username =
        ctx.from?.username || ctx.from?.first_name || "Unknown";
      const usr = await getUser(userId, username);
      if (usr) {
        usr.bank_details.bank_name = bankName;
        usr.bank_details.bank_code = bankCode;
        usr.bank_details.account_name = accountName;
        usr.bank_details.account_number = accountNumber;
        await usr.save();
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback("🔙 Back to Main Menu", "back_to_menu"),
            Markup.button.callback("📊 View Profile", "view_profile"),
          ],
        ]);
        await sendOrEdit(
          ctx,
          "✅ Bank details updated successfully!",
          keyboard
        );
      } else {
        await ctx.reply("❌ User not found.");
      }
      clearBankUpdateState(userId);
    }
    return;
  }

  if (cbData === "final_confirmation:cancel") {
    await ctx.answerCbQuery("Cancelled");
    await ctx.reply("Operation cancelled.");
    clearBankUpdateState(userId);
    return;
  }
}

export async function handleBankNameConfirmation(ctx: Context): Promise<void> {
  const cbData =
    (ctx.callbackQuery && (ctx.callbackQuery as any).data) || null;
  if (!cbData || typeof cbData !== "string") return;

  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("❌ Unable to identify user.");
    return;
  }

  if (cbData.startsWith("update_bank_name:confirm:")) {
    await ctx.answerCbQuery("Saving...");
    const parts = cbData.split(":");
    const idx = parseInt(parts[2], 10);
    const bank = SUPPORTED_NIGERIAN_BANKS[idx];
    if (!bank) {
      await ctx.reply("❌ Invalid selection.");
      return;
    }

    setBankUpdateState(userId, "awaiting_account_name", {
      bankName: bank.Name,
      bankCode: bank.Code,
    });
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("❌ Cancel", "delete_message")],
    ]);
    await ctx.reply("Please enter your account name.", keyboard);
    return;
  }

  if (cbData === "update_bank_name:cancel") {
    await ctx.answerCbQuery("Cancelled");
    await ctx.reply("Operation cancelled.");
    clearBankUpdateState(userId);
    return;
  }
}

export async function handleBankUpdate(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const message = (ctx.message as any)?.text;

  if (!userId || !message) {
    return;
  }

  const state = getBankUpdateState(userId);
  if (!state) {
    return;
  }

  const { step, data } = state;

  switch (step) {
    case "awaiting_bank_name":
      break;

    case "awaiting_account_name":
      setBankUpdateState(userId, "awaiting_account_number", {
        accountName: message,
      });
      const accountNumberKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback("❌ Cancel", "delete_message")],
      ]);
      await ctx.reply(
        "Please enter your account number.",
        accountNumberKeyboard
      );
      break;

    case "awaiting_account_number":
      const { bankName, accountName } = data;
      const confirmMessage = `
Please confirm your bank details:

**Bank Name:** ${bankName}
**Account Name:** ${accountName}
**Account Number:** ${message}

Is this correct?
      `;

      const confirmKeyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Accept", "final_confirmation:confirm"),
          Markup.button.callback("❌ Decline", "final_confirmation:cancel"),
        ],
        [Markup.button.callback("❌ Cancel", "delete_message")],
      ]);

      setBankUpdateState(userId, "awaiting_final_confirmation", {
        accountNumber: message,
      });
      await ctx.reply(confirmMessage, {
        parse_mode: "Markdown",
        ...confirmKeyboard,
      });
      break;

    case "awaiting_withdrawal_pin":
      const pin = message.trim();

      if (!/^\d{4}$/.test(pin)) {
        await ctx.reply(
          "❌ Invalid pin format. Please enter a 4-digit numeric pin."
        );
        return;
      }

      const pinNum = parseInt(pin, 10);

      if (
        pinNum === 0 ||
        pin === "0000" ||
        pinNum === 1234 ||
        pinNum === 1111 ||
        pinNum === 2222 ||
        pinNum === 3333 ||
        pinNum === 4444 ||
        pinNum === 5555 ||
        pinNum === 6666 ||
        pinNum === 7777 ||
        pinNum === 8888 ||
        pinNum === 9999
      ) {
        await ctx.reply(
          "❌ Pin cannot be a common sequence like 0000, 1234, 1111, etc. Please enter a more secure 4-digit pin."
        );
        setBankUpdateState(userId, "awaiting_withdrawal_pin");
        return;
      }

      const withdrawalPinConfirmMessage = `
You have entered the pin: **${pin}**

Please confirm to set this as your withdrawal pin.
        `;

      const withdrawalPinConfirmKeyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "✅ Accept",
            `set_withdrawal_pin:confirm:${pin}`
          ),
          Markup.button.callback("❌ Decline", `set_withdrawal_pin:cancel`),
        ],
        [Markup.button.callback("❌ Cancel", "delete_message")],
      ]);

      setBankUpdateState(userId, "awaiting_withdrawal_pin_confirmation", {
        withdrawalPin: pinNum,
      });
      await ctx.reply(withdrawalPinConfirmMessage, {
        parse_mode: "Markdown",
        ...withdrawalPinConfirmKeyboard,
      });
      break;
  }
}

export async function handleBankNameSelection(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    return;
  }
  const state = getBankUpdateState(userId);
  if (!state || state.step !== "awaiting_bank_name") {
    return;
  }

  const text = (ctx.message && (ctx.message as any).text) || "";
  if (text && typeof text === "string") {
    const trimmed = text.trim();
    const numeric = parseInt(trimmed, 10);
    if (!isNaN(numeric)) {
      const idx = numeric - 1;
      if (idx < 0 || idx >= SUPPORTED_NIGERIAN_BANKS.length) {
        await ctx.reply(
          `❌ Please enter a number between 01 and ${SUPPORTED_NIGERIAN_BANKS.length
            .toString()
            .padStart(2, "0")}.`
        );
        return;
      }

      const bank = SUPPORTED_NIGERIAN_BANKS[idx];
      const confirmKeyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "✅ Accept",
            `update_bank_name:confirm:${idx}`
          ),
          Markup.button.callback("❌ Decline", `update_bank_name:cancel`),
        ],
        [Markup.button.callback("❌ Cancel", "delete_message")],
      ]);

      await ctx.reply(
        `You selected: <b>${bank.Name}</b> (Code: <code>${bank.Code}</code>)\n\nDo you want to save this as your bank?`,
        { parse_mode: "HTML", ...confirmKeyboard }
      );
      return;
    }
  }
}

export async function handleSetWithdrawalPin(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
  if (!userId) {
    await ctx.reply("❌ Unable to identify user.");
    return;
  }
  const usr = getUser(userId, username);
  const usrPin = (await usr).bank_details.withdrawalPin;
  if (usrPin && usrPin !== 0) {
    await ctx.reply(
      " You have already set a withdrawal pin. If you wish to change it, please contact support."
    );
    return;
  }

  setBankUpdateState(userId, "awaiting_withdrawal_pin");
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("❌ Cancel", "delete_message")],
  ]);
  await ctx.reply(
    "Please enter a 4-digit withdrawal pin you would like to set for your account.",
    keyboard
  );
}

export async function handleSetWithdrawalPinConfirmation(ctx: Context): Promise<void> {
  const cbData =
    (ctx.callbackQuery && (ctx.callbackQuery as any).data) || null;
  if (!cbData || typeof cbData !== "string") return;

  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("❌ Unable to identify user.");
    return;
  }

  const state = getBankUpdateState(userId);
  if (!state || state.step !== "awaiting_withdrawal_pin_confirmation") {
    return;
  }

  if (cbData.startsWith("set_withdrawal_pin:confirm:")) {
    await ctx.answerCbQuery("Saving...");
    const parts = cbData.split(":");
    const pin = Number(parts[2]);

    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
    const usr = await getUser(userId, username);
    if (usr) {
      usr.bank_details.withdrawalPin = pin;
      await usr.save();
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("🔙 Back to Main Menu", "back_to_menu"),
          Markup.button.callback("📊 View Profile", "view_profile"),
        ],
      ]);
      await sendOrEdit(ctx, "✅ Withdrawal pin set successfully!", keyboard);
    } else {
      await ctx.reply("❌ User not found.");
    }
    clearBankUpdateState(userId);
    return;
  }

  if (cbData === "set_withdrawal_pin:cancel") {
    await ctx.answerCbQuery("Cancelled");
    await ctx.reply("Operation cancelled.");
    clearBankUpdateState(userId);
    return;
  }
}
