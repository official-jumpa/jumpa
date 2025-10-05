import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";

export class InfoCommand extends BaseCommand {
  name = "info";
  description = "Get bot information";

  async execute(ctx: Context): Promise<void> {
    const info = `
📊 *Bot Information:*
• Name: Jumpa Bot
• Version: 1.0.0
• Framework: Telegraf
• Language: TypeScript
• Status: ✅ Active
    `;
    await this.sendMessage(ctx, info, "Markdown");
  }
}
