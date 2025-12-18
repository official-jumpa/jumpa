import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import getUser from "@modules/users/getUserInfo";
import {
  validateAndSanitizeGroupName,
  validateGroupCreation,
} from "./functions";
import { BlockchainServiceFactory } from "@blockchain/core/BlockchainServiceFactory";
import { BlockchainType } from "@blockchain/core/types/BlockchainType";

/**
 * Handles the /create command with blockchain parameter
 * Format: /create blockchain groupName visibility
 * Example: /create base MyFirstGroup true
 */
export class CreateGroupCommand extends BaseCommand {
  name = "create_group";
  description = "Create a new group with custom parameters";

  async execute(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }
      // Check if user is registered
      try {
        await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      // Parse the command text
      const text = "text" in ctx.message ? ctx.message.text : "";
      const parts = text.split(" ");

      // Validate command format: /create blockchain groupName visibility
      if (parts.length !== 4) {
        await ctx.reply(
          `<b>❌ Invalid command format</b>

<b>Usage:</b> <code>/create blockchain groupName visibility</code>
<b>Examples:</b>
<code>/create base MyFirstGroup true</code>
<code>/create solana MyGroup false</code>`,
          { parse_mode: "HTML" }
        );
        return;
      }

      const [, blockchain, groupName, visibilityStr] = parts;

      // Validate blockchain parameter
      const validBlockchains = ["base", "solana"];
      if (!validBlockchains.includes(blockchain.toLowerCase())) {
        await ctx.reply(
          `<b>❌ Invalid blockchain</b>

Supported blockchains: <b>base</b>, <b>solana</b>

<b>Examples:</b>
<code>/create base MyFirstGroup true</code>
<code>/create solana MyGroup false</code>`,
          { parse_mode: "HTML" }
        );
        return;
      }

      // Validate visibility parameter
      if (visibilityStr !== "true" && visibilityStr !== "false") {
        await ctx.reply(
          `<b>❌ Invalid visibility parameter</b>

Visibility must be either <b>true</b> (public) or <b>false</b> (private).

<b>Example:</b> <code>/create ${blockchain} MyFirstGroup true</code>`,
          { parse_mode: "HTML" }
        );
        return;
      }
      const isPublic = visibilityStr === "true";
      const blockchainDisplay =
        blockchain.charAt(0).toUpperCase() + blockchain.slice(1);

      // Get blockchain service
      const blockchainType = blockchain.toLowerCase() === "base" ? BlockchainType.BASE : BlockchainType.SOLANA;
      const blockchainService = BlockchainServiceFactory.getService(blockchainType);

      // Send initial loading message
      const loadingMsg = await ctx.reply(
        `⏳ Creating group on ${blockchainDisplay}... This might take up to a minute`
      );
      const loadingMsgId = loadingMsg.message_id;

      const nameValidation = validateAndSanitizeGroupName(groupName);
      if (!nameValidation.isValid) {
        await ctx.reply(`❌ ${nameValidation.errors.join(", ")}`);
        return;
      }

      const validation = validateGroupCreation({
        name: nameValidation.sanitized,
      });

      if (!validation.isValid) {
        await ctx.reply(`❌ ${validation.errors.join(", ")}`);
        return;
      }

      try {
        // Create the group using blockchain-agnostic service
        const createGrp = await blockchainService.createGroup(ctx, groupName, isPublic);
        console.log("createGrp", createGrp);

        if (createGrp.success && createGrp.data) {
          const successMessage = `
<b>✅ Group Created Successfully!</b>

<b>Group Details:</b>
• <b>Name:</b> ${groupName}
• <b>Blockchain:</b> ${blockchainDisplay}
• <b>Group Type:</b> ${isPublic ? "Public 🌐" : "Private 🔒"}
• <b>Creator:</b> @${username}

<b>Group Address:</b> <code>${createGrp.data.groupAddress || "N/A"}</code>

<b>Other members can now join using the group address</b>

<b>Transaction Hash:</b> <code>${createGrp.transactionHash || createGrp.data.hash || "Processing..."}</code>

Your group is now active and ready to use! 🚀
          `;
          // Replace loading message with success message
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            loadingMsgId,
            undefined,
            successMessage,
            { parse_mode: "HTML" }
          );
        } else {
          const errorMessage = `
<b>❌ Failed to create group</b>

• <b>Name:</b> ${groupName}
• <b>Blockchain:</b> ${blockchainDisplay}
• <b>Visibility:</b> ${isPublic ? "Public 🌐" : "Private 🔒"}
• <b>Creator:</b> @${username}

<b>Reason:</b> ${createGrp.error || "Unknown error occurred"}
          `;
          // Replace loading message with error message
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            loadingMsgId,
            undefined,
            errorMessage,
            { parse_mode: "HTML" }
          );
        }
      } catch (error) {
        console.error("Error creating group:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        // Replace loading message with error message
        try {
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            loadingMsgId,
            undefined,
            `<b>❌ An error occurred while creating the group</b>

<b>Error:</b> ${errorMessage}

Please try again later or contact support if the issue persists.`,
            { parse_mode: "HTML" }
          );
        } catch (editError) {
          // If editing fails, send a new message
          await ctx.reply(
            `❌ An error occurred while processing your request: ${errorMessage}`
          );
        }
      }
    } catch (error) {
      console.error("Create group error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to create group: ${errorMessage}`);
    }
  }
}
