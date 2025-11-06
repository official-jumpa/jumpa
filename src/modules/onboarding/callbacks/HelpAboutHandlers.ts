import { Context } from "telegraf";

export class HelpAboutHandlers {
  // Handle show help callback
  static async handleShowHelp(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("❓ Help & Commands");

      const helpMessage =
        `<b>❓ Help & Commands</b>

<b>Available Commands:</b>
/start - Start the bot and register
/wallet - View your wallet information
/profile - View your profile details
/help - Show this help message
/ping - Check if bot is alive
/info - Get bot information


/create_group - Create a group
/join group_id - Join a group
/vote poll_id yes/no - Vote on polls
/history - View trading history

<b>Need Support?</b>
Contact @your_support_username for help!`

      await ctx.reply(helpMessage, { parse_mode: "HTML" });
    } catch (error) {
      console.error("Show help error:", error);
      await ctx.answerCbQuery("❌ Failed to show help.");
    }
  }

  // Handle show about callback
  static async handleShowAbout(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("ℹ️ About Jumpa");

      const aboutMessage = `
 ℹ️ **About Jumpa Bot**

**What is Jumpa?**
Jumpa is a Telegram bot that enables collaborative trading through groups - traditional savings groups reimagined for the digital age.

**Key Features:**
🔑 **Auto-generated Solana wallets** for each user
💰 **Collective fund pooling** with SOL
🗳️ **Democratic voting** on trading decisions
📊 **Transparent profit sharing** based on contributions
🔒 **Secure smart contract integration**

**How It Works:**
1. Create or join an group
2. Contribute SOL to the group pool
3. Vote on trading proposals
4. Share profits based on your contribution

**Built on Solana** for fast, cheap transactions!

**Version:** 1.0.0 (MVP)
**Status:** In Development
      `;

      await ctx.reply(aboutMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error("Show about error:", error);
      await ctx.answerCbQuery("❌ Failed to show about.");
    }
  }
}
