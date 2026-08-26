import "dotenv/config";
import OpenAI from "openai";
import { config } from "@core/config/environment";
import { tools as localTools } from "@src/ai-agent/tools";

const deepseekApiKey = config.deepseekApiKey || process.env.DEEPSEEK_API_KEY;

// Initialize DeepSeek client (OpenAI compatible)
const deepseek = deepseekApiKey
  ? new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: deepseekApiKey,
    })
  : null;

const SYSTEM_PROMPT = `
You are a banking assistant for Jumpa. Your job is to facilitate withdrawals and blockchain actions.

RESPONSE RULES:
- Be extremely concise
- NO explanations, NO reasoning, NO thinking out loud
- When asking for information, ask ONLY the question

IMAGE PROCESSING:
- If withdrawal details from an image or receipt are provided:
  - Account Number
  - Bank Name
  - Account Name
  - Amount (if visible)
- Extract chain and currency from the user's message (e.g., "send from my usdc on sol" means SOLANA and USDC, "from ton" means TON)
- If user provides MULTIPLE recipient details simultaneously, treat as bulk transfer

BANK TRANSFER WORKFLOW:
1. Extract account number, bank name, amount
2. Call 'validate_withdrawal_details' to verify the account (this returns the verified account_name)
3. Extract chain and currency from the user's text message
4. Once you have ALL details (amount, account_number, bank_name, account_name, chain, currency):
   → IMMEDIATELY call 'confirm_withdrawal' tool
   → DO NOT ask for user confirmation before calling the tool
   → The tool will trigger the PIN flow automatically
5. If any details are missing, ask ONLY for the missing ones

BULK TRANSFER WORKFLOW:
1. Detect bulk intent: Multiple accounts OR user says "send to each" OR lists multiple accounts
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
   - Source: Crypto Chain (SOLANA, BASE, CELO) + Currency.
   - Amount: Naira (NGN).

2. **CRYPTO TRANSFER**: User wants to send crypto to an external wallet address.
   - Destination: Wallet Address (SOLANA, BASE, CELO, STELLAR, TON).
   - Source: Crypto Chain + Currency.
   - Amount: Naira (NGN) or Crypto Amount.
`;

export interface AgentResponse {
  type: "text" | "confirmation" | "bulk_confirmation" | "error";
  message?: string;
  data?: any;
  updatedHistory?: any[];
}

/**
 * Helper to extract receipt text from image using Gemini if available
 */
async function extractReceiptFromImage(base64Image: string, mimeType: string = "image/jpeg"): Promise<string> {
  if (!config.geminiApiKey) return "";
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Image,
              },
            },
            {
              text: "Extract all banking/receipt details accurately: Account Number, Bank Name, Account Name, Amount (NGN). Output only the extracted details concisely.",
            },
          ],
        },
      ],
    });
    return response.text || "";
  } catch (error) {
    console.error("[Image OCR] Error with Gemini OCR helper:", error);
    return "";
  }
}

export async function processUserQuery(
  userId: number,
  userMessage: string | Array<any>,
  previousHistory: any[] = []
): Promise<AgentResponse> {
  if (!deepseek) {
    console.error("DeepSeek API Key missing");
    return { type: "error", message: "AI Service Not Configured. Please set DEEPSEEK_API_KEY in .env." };
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
    // Format local tools into OpenAI/DeepSeek function calling schema
    const tools: OpenAI.ChatCompletionTool[] = localTools.map(t => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

    // Convert history or start fresh
    let messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...previousHistory,
    ];

    // Handle userMessage formatting (handling text vs multimodal images)
    let processedUserText = "";
    if (Array.isArray(userMessage)) {
      let imageText = "";
      let rawText = "";
      for (const part of userMessage) {
        if (part.type === "text") {
          rawText += part.text + " ";
        } else if (part.type === "image" && part.source?.data) {
          const ocrResult = await extractReceiptFromImage(part.source.data, part.source.media_type || "image/jpeg");
          if (ocrResult) {
            imageText += `\n[Extracted from uploaded receipt image]:\n${ocrResult}\n`;
          }
        }
      }
      processedUserText = (rawText + " " + imageText).trim();
      messages.push({ role: "user", content: processedUserText });
    } else {
      processedUserText = userMessage;
      messages.push({ role: "user", content: userMessage });
    }

    // Run the agent loop (up to 5 turns to execute tools)
    for (let i = 0; i < 5; i++) {
      const response = await deepseek.chat.completions.create({
        model: "deepseek-chat",
        max_tokens: 1024,
        messages: messages,
        tools: tools,
        tool_choice: "auto",
      });

      const choice = response.choices[0];
      const message = choice.message;

      console.log(`[DeepSeek Agent] Turn ${i + 1} FinishReason=${choice.finish_reason}`, JSON.stringify(message));

      // Append assistant's response to history
      messages.push(message);

      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.type === "function") {
            const toolName = toolCall.function.name;
            let toolInput: any = {};
            try {
              toolInput = JSON.parse(toolCall.function.arguments || "{}");
            } catch (err) {
              toolInput = {};
            }

            console.log(`[DeepSeek Agent] Invoking tool: ${toolName}`, toolInput);

            // 1. Handle Withdrawal Confirmation (Bank/Crypto)
            if (toolName === "confirm_withdrawal") {
              return {
                type: "confirmation",
                data: toolInput,
                updatedHistory: messages.filter(m => m.role !== "system"),
              };
            }

            // 2. Handle Bulk Withdrawal Confirmation
            if (toolName === "confirm_bulk_withdrawal") {
              return {
                type: "bulk_confirmation",
                data: toolInput,
                updatedHistory: messages.filter(m => m.role !== "system"),
              };
            }

            // 3. Execute Local Tool
            let result: any;
            try {
              const localTool = localTools.find(t => t.name === toolName);
              if (!localTool) {
                throw new Error(`Tool '${toolName}' not found.`);
              }
              result = await localTool.handler(toolInput);
            } catch (err: any) {
              result = { error: err.message };
            }

            // Append tool response
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          }
        }
      } else {
        // Text response
        if (message.content) {
          return {
            type: "text",
            message: message.content,
            updatedHistory: messages.filter(m => m.role !== "system"),
          };
        }
        return { type: "error", message: "No response from AI" };
      }
    }

    return { type: "error", message: "Agent loop limit reached" };
  } catch (error: any) {
    console.error("[DeepSeek Agent] Process Error:", error);
    return { type: "error", message: "Sorry, I encountered an error processing your request." };
  }
}
