
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { tools as localTools } from "@src/ai-agent/tools";

const apiKey = process.env.ANTHROPIC_API_KEY;

// Only initialize if key exists, otherwise we might want to handle gracefully in the app
// provided this is running in a server environment that has the env.
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

const SYSTEM_PROMPT = `
You are a banking assistant for Jumpa. Your job is to facilitate withdrawals and blockchain actions.

RESPONSE RULES:
- Be extremely concise
- NO explanations, NO reasoning, NO thinking out loud
- When asking for information, ask ONLY the question

IMAGE PROCESSING:
- If the user provides an image, scan it for withdrawal details:
  - Account Number
  - Bank Name
  - Account Name
  - Amount (if visible)
- Extract chain and currency from the user's message (e.g., "send from my usdc on sol" means SOLANA and USDC)
- If user sends MULTIPLE images simultaneously, treat as bulk transfer (extract details from each image)

BANK TRANSFER WORKFLOW:
1. Extract account number, bank name, amount from image
2. Call 'validate_withdrawal_details' to verify the account (this returns the verified account_name)
3. Extract chain and currency from the user's text message
4. Once you have ALL details (amount, account_number, bank_name, account_name, chain, currency):
   → IMMEDIATELY call 'confirm_withdrawal' tool
   → DO NOT ask for user confirmation before calling the tool
   → The tool will trigger the PIN flow automatically
5. If any details are missing, ask ONLY for the missing ones

BULK TRANSFER WORKFLOW:
1. Detect bulk intent: Multiple images OR user says "send to each" OR lists multiple accounts
2. Extract details for EACH recipient (up to 5 maximum)
3. Validate ALL accounts in parallel using 'validate_withdrawal_details'
4. Extract common chain and currency from user's message
5. Once you have ALL recipient details:
   → IMMEDIATELY call 'confirm_bulk_withdrawal' tool with recipients array
   → Each recipient can have different amount
   → DO NOT ask for confirmation before calling the tool
6. The tool will trigger bulk PIN flow with summary of all transfers

SUPPORTED MODES:
1. **BANK TRANSFER**: User wants to send money to a Nigerian Bank Account.
   - Destination: Bank Name + Account Number.
   - Source: Crypto Chain + Currency.
   - Amount: Naira (NGN).

2. **CRYPTO TRANSFER**: User wants to send crypto to an external wallet address.
   - Destination: Wallet Address.
   - Source: Crypto Chain + Currency.
   - Amount: Naira (NGN).
`;

export interface AgentResponse {
  type: "text" | "confirmation" | "bulk_confirmation" | "error";
  message?: string;
  data?: any;
  updatedHistory?: any[];
}

export async function processUserQuery(
  userId: number,
  userMessage: string | Array<any>,
  previousHistory: any[] = []
): Promise<AgentResponse> {
  if (!anthropic) {
    console.error("Anthropic API Key missing");
    return { type: "error", message: "AI Service Not Configured" };
  }

  // Input validation for text-only messages
  const MAX_MESSAGE_LENGTH = 10000;
  if (typeof userMessage === 'string' && userMessage.length > MAX_MESSAGE_LENGTH) {
    return { type: "error", message: "Message too long. Please keep it under 10000 characters." };
  }

  if (typeof userMessage === 'string') {
    const BLOCKED_PATTERNS = [/\<script\>/i, /javascript:/i];
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(userMessage)) {
        return { type: "error", message: "Invalid input." };
      }
    }
  }

  try {
    // Dynamic Tool Loading from local tools
    const tools = localTools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema
    }));

    // Start with previous history and append the new user message
    let messages: any[] = [...previousHistory];

    // Add new message correctly based on type
    if (Array.isArray(userMessage)) {
      // It's a multimodal message (e.g. text + image)
      messages.push({ role: "user", content: userMessage });
    } else {
      // It's a simple text string
      messages.push({ role: "user", content: userMessage });
    }

    // Run the loop (max 5 turns to prevent infinite loops)
    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: tools,
        messages: messages,
      });

      const stopReason = response.stop_reason;
      const content = response.content;

      console.log(`[AI Agent] Turn ${i + 1} Response: StopReason=${stopReason}`, JSON.stringify(content));

      // Append assistant's response to history
      messages.push({ role: "assistant", content: content });

      if (stopReason === "tool_use") {
        const toolResults = [];

        for (const block of content) {
          if (block.type === "tool_use") {
            const toolName = block.name;
            const toolInput = block.input;
            const toolId = block.id;

            console.log(`[AI Agent] Invoking tool: ${toolName}`, toolInput);

            // 1. Handle Withdrawal Confirmation (Bank/Crypto)
            if (toolName === "confirm_withdrawal") {
              return {
                type: "confirmation",
                data: toolInput,
                updatedHistory: messages
              };
            }

            // 2. Handle Bulk Withdrawal Confirmation
            if (toolName === "confirm_bulk_withdrawal") {
              return {
                type: "bulk_confirmation",
                data: toolInput,
                updatedHistory: messages
              };
            }

            // 3. Execute Local Tool
            try {
              const localTool = localTools.find(t => t.name === toolName);
              if (!localTool) {
                throw new Error(`Tool '${toolName}' not found.`);
              }
              const result = await localTool.handler(toolInput);

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolId,
                content: JSON.stringify(result)
              });
            } catch (err: any) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolId,
                content: JSON.stringify({ error: err.message }),
                is_error: true
              });
            }
          }
        }

        console.log(`[AI Agent] Tool Results:`, JSON.stringify(toolResults));
        messages.push({ role: "user", content: toolResults });

        // Continue loop to let Claude process tool results
      } else {
        // Text response
        const textBlock = content.find(c => c.type === "text");
        if (textBlock && textBlock.text) {
          return {
            type: "text",
            message: textBlock.text,
            updatedHistory: messages
          };
        }
        return { type: "error", message: "No response from AI" };
      }
    }

    return { type: "error", message: "Agent loop limit reached" };

  } catch (error: any) {
    console.error("[AI Agent] Process Error:", error);
    return { type: "error", message: "Sorry, I encountered an error processing your request." };
  }
}
