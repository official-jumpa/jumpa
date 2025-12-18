import { Context } from "telegraf";
import Group from "@core/database/models/group";
import { fetchBaseGroupInfo } from "@blockchain/base/fetchGroupInfo";

/**
 * Shared utility to display group information
 * Used by both GroupInfoCommand and callback handlers
 */
export async function displayGroupInfo(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.reply("❌ Unable to identify chat.");
    return;
  }

  const group = await Group.findOne({ telegram_chat_id: chatId });
  if (!group) {
    await ctx.reply(
      "❌ No group found in this chat.\n\n" +
        "Use `/create base GroupName true` to create a new group.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Check if group has a group_address
  if (!group.group_address) {
    await ctx.reply(
      "❌ This group doesn't have a blockchain address. Please create a new group."
    );
    return;
  }

  // Send loading message
  const loadingMsg = await ctx.reply(
    "⏳ Fetching group info from blockchain... This might take a moment"
  );
  const loadingMsgId = loadingMsg.message_id;

  // Determine blockchain based on address format
  const isBaseChain = group.group_address.startsWith("0x");

  if (isBaseChain) {
    // Fetch Base blockchain group info
    try {
      const grpInfo = await fetchBaseGroupInfo(group.group_address);
      console.log("grpInfo", grpInfo);

      if (grpInfo.success) {
        let grpStatus: string;
        if (grpInfo.data.state === "0") {
          grpStatus = "Open 🟢";
        } else if (grpInfo.data.state === "1") {
          grpStatus = "Trading 🔵";
        } else if (grpInfo.data.state === "2") {
          grpStatus = "Closed 🔴";
        } else {
          grpStatus = "Paused ⏸️";
        }

        const minimumDepositEth = Number(grpInfo.data.minimumDeposit) / 1e18;
        const totalContributionsEth =
          Number(grpInfo.data.totalContributions) / 1e18;

        const successMessage = `
<b>${grpInfo.data.isPrivate ? "🔒 Private" : "🌐 Public"} Group - ${grpInfo.data.name}</b>

<b>Blockchain:</b> Base

<b>Group Address:</b> <code>${grpInfo.data.groupAddress}</code>

<b>Status:</b> ${grpStatus}

<b>👥 Members:</b> ${grpInfo.data.members.length}
<b>📊 Traders:</b> ${grpInfo.data.traders.length}

<b>💰 Financial Info:</b>
• <b>Minimum Deposit:</b> ${minimumDepositEth} ETH
• <b>Total Contributions:</b> ${totalContributionsEth} ETH

<b>⚙️ Trading Settings:</b>
• <b>Max Slippage:</b> ${grpInfo.data.maxSlippagePercentage}%
• <b>Max Swap:</b> ${grpInfo.data.maxSwapPercentage}%

<b>📅 Created:</b> ${new Date(grpInfo.data.createdAt * 1000).toLocaleDateString()}

<b>Database ID:</b> <code>${group._id}</code>
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
<b>❌ Failed to fetch group info from Base blockchain</b>

<b>Group Address:</b> <code>${group.group_address}</code>

<b>Reason:</b> ${grpInfo.data || "Unknown error occurred"}

Please try again later or contact support.
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
      console.error("Error fetching Base group info:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      try {
        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          loadingMsgId,
          undefined,
          `<b>❌ An error occurred while fetching group info</b>

<b>Error:</b> ${errorMessage}

Please try again later.`,
          { parse_mode: "HTML" }
        );
      } catch (editError) {
        await ctx.reply(
          `❌ An error occurred while fetching group info: ${errorMessage}`
        );
      }
    }
  } else {
    // Solana blockchain - placeholder for now
    const placeholderMessage = `
<b>🚧 Solana Group Info - Coming Soon</b>

<b>Group Name:</b> ${group.name}
<b>Blockchain:</b> Solana ◎

<b>Group Address:</b> <code>${group.group_address}</code>

<b>Status:</b> Solana integration is currently under development.

<b>📊 Database Info:</b>
• <b>Members:</b> ${group.members.length}
• <b>Active Polls:</b> ${group.polls.filter((p: any) => p.status === "open").length}
• <b>Total Trades:</b> ${group.trades.length}

<b>📅 Created:</b> ${new Date(group.createdAt).toLocaleDateString()}

<b>Database ID:</b> <code>${group._id}</code>

Full Solana blockchain integration will be available soon! 🚀
        `;

    // Replace loading message with placeholder message
    await ctx.telegram.editMessageText(
      ctx.chat!.id,
      loadingMsgId,
      undefined,
      placeholderMessage,
      { parse_mode: "HTML" }
    );
  }
}
