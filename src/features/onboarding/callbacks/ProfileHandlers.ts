import { Context } from "telegraf";
import getUser from "@features/users/getUserInfo";
import { Markup } from "telegraf";
import { sendOrEdit } from "@shared/utils/messageHelper";

// Format date helper for profile joined date
function formatDateJoined(dateInput?: Date | string): string {
  if (!dateInput) return "Unknown";
  const date = new Date(dateInput);
  const day = date.getDate();
  const suffix = ["th", "st", "nd", "rd"][((day % 100) - 20) % 10] || ["th", "st", "nd", "rd"][day % 10] || "th";
  return `${day}${suffix} ${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
}

// Handle view profile callback
export async function handleViewProfile(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

    if (!telegramId) {
      await ctx.answerCbQuery("❌ Unable to identify your account.");
      return;
    }

    await ctx.answerCbQuery("📊 Loading profile...");

    const user = await getUser(telegramId, username);

    if (!user) {
      await ctx.reply(
        "❌ User not found. Please use /start to register first."
      );
      return;
    }

    const profileMessage = `
<b>📊 Your Profile</b>

<b>Username:</b> @${username}

<b>Joined on:</b> ${formatDateJoined(user.createdAt)}
    `;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback("🏧 Bank Details", "view_bank_account"),
        Markup.button.callback("✍️ Update Bank Details", "update_bank_name"),
      ],
      [
        Markup.button.callback("Backup Wallet", "export_private_key"),
        Markup.button.callback("Back to Main Menu", "back_to_menu"),
      ],
    ]);

    await sendOrEdit(ctx, profileMessage, {
      parse_mode: "HTML",
      ...keyboard,
    });
  } catch (error) {
    console.error("View profile error:", error);
    await ctx.answerCbQuery("❌ Failed to load profile.");
  }
}
