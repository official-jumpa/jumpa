import { Context, Markup } from "telegraf";
import User from "@core/database/models/user";
import { encodeBase62 } from "@shared/utils/base62";
import { sendOrEdit } from "@shared/utils/messageHelper";

export const referralCommandConfig = {
  name: "referral",
  description: "View referral stats and get referral link",
};

export async function handleReferralCommand(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.reply("❌ Unable to identify your Telegram account.");
      return;
    }

    const user = await User.findOne({ telegram_id: telegramId });

    if (!user) {
      await ctx.reply("❌ User not found. Please use /start first.");
      return;
    }

    if (!user.referrals?.referralCode) {
      const referralCode = encodeBase62(telegramId);
      user.referrals = {
        ...user.referrals,
        referralCode,
      };
      await user.save();
    }

    const referralCode = user.referrals.referralCode;
    const totalReferrals = user.referrals?.totalReferrals || 0;
    const referralPoints = user.referrals?.referralPoints || 0;

    const botUsername = ctx.botInfo?.username || "jumpa_bot";
    const referralLink = `https://t.me/${botUsername}?start=ref_${referralCode}`;

    const message = `
• Total Referrals: ${totalReferrals}
• Referral Points: ${referralPoints}

*Your Referral Link:*
\`${referralLink}\`

Share your referral link with your friends and earn points for each friend who joins using your link, places a trade or withdraws via P2P!

Click the link above to copy and share it.`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Back to Main Menu", "back_to_menu")],
    ]);
    await sendOrEdit(ctx, message, { parse_mode: "Markdown", ...keyboard });
  } catch (error) {
    console.error("Referral command error:", error);
    await ctx.reply(
      "❌ An error occurred while fetching your referral information."
    );
  }
}
