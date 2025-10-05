import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";

export class PingCommand extends BaseCommand {
  name = "ping";
  description = "Check if bot is alive";

  async execute(ctx: Context): Promise<void> {
    await this.sendMessage(ctx, "🏓 Pong! Bot is alive and running.");
  }
}
