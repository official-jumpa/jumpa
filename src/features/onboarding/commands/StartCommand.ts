import { Context } from "telegraf";
import getUser from "@features/users/getUserInfo";
import { encodeBase62, decodeBase62 } from "@shared/utils/base62";
import User from "@core/database/models/user";
import { displayMainMenu } from "@features/onboarding/utils/displayMainMenu";

export const startCommandConfig = {
  name: "start",
  description: "Start the bot and show welcome message",
};

export async function handleStartCommand(ctx: Context): Promise<void> {
  try {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

    if (!telegramId) {
      await ctx.reply(
        "❌ Unable to identify your Telegram account. Please try again."
      );
      return;
    }

    let referrerTelegramId: number | null = null;

    if (ctx.message && 'text' in ctx.message && ctx.message.text) {
      const messageText = ctx.message.text;
      console.log(`Start command received with text: "${messageText}"`);
      const parts = messageText.split(' ');

      if (parts.length > 1) {
        const startPayload = parts[1];
        console.log(`Start payload detected: "${startPayload}"`);

        if (startPayload.startsWith("ref_")) {
          try {
            const referralCode = startPayload.substring(4);
            referrerTelegramId = decodeBase62(referralCode);
            console.log(`✅ Referral code parsed successfully: ${referralCode} → Referrer ID: ${referrerTelegramId}`);
          } catch (error) {
            console.error("❌ Invalid referral code:", error);
          }
        }
      }
    }

    const existingUser = await User.findOne({ telegram_id: telegramId });
    const isNewUser = !existingUser;

    const user = await getUser(telegramId, username);

    if (!user.referrals?.referralCode) {
      const referralCode = encodeBase62(telegramId);
      user.referrals = {
        ...user.referrals,
        referralCode,
        referralPoints: user.referrals?.referralPoints || 0,
        referredBy: user.referrals?.referredBy || null,
        totalReferrals: user.referrals?.totalReferrals || 0,
        myReferrals: user.referrals?.myReferrals || [],
      };
      await user.save();
    }

    console.log(`Referral check - isNewUser: ${isNewUser}, referrerTelegramId: ${referrerTelegramId}, telegramId: ${telegramId}`);

    if (
      isNewUser &&
      referrerTelegramId &&
      referrerTelegramId !== telegramId
    ) {
      console.log(`Attempting to link referral for new user ${telegramId} with referrer ${referrerTelegramId}`);

      const referrer = await User.findOne({
        telegram_id: referrerTelegramId,
      });

      if (referrer) {
        console.log(`✅ Referrer found: ${referrer.username} (ID: ${referrerTelegramId})`);

        user.referrals.referredBy = referrerTelegramId;
        await user.save();

        referrer.referrals.myReferrals =
          referrer.referrals.myReferrals || [];
        referrer.referrals.myReferrals.push(telegramId);
        referrer.referrals.totalReferrals =
          (referrer.referrals.totalReferrals || 0) + 1;
        referrer.referrals.referralPoints =
          (referrer.referrals.referralPoints || 0) + 100;
        await referrer.save();

        console.log(`✅ Referral successful! Awarded 100 points to ${referrer.username}. New points: ${referrer.referrals.referralPoints}`);
      } else {
        console.log(`❌ Referrer not found in database for ID: ${referrerTelegramId}`);
      }
    } else {
      if (!isNewUser) {
        console.log(`User ${telegramId} already exists, skipping referral linking`);
      }
    }

    await displayMainMenu(ctx, telegramId, username);
  } catch (error) {
    console.error("Start command error:", error);
    await ctx.reply("❌ An error occurred. Please try again later.");
  }
}
