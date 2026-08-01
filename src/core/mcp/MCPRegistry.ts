import { mcpConfig } from "@core/config/mcp.config";
import { MCPClient, ToolDefinition } from "./MCPClient";
import { tools as localTools } from "@src/ai-agent/tools";

export class MCPRegistry {
  private static instance: MCPRegistry;
  private clients: Map<string, MCPClient> = new Map();
  private cachedTools: ToolDefinition[] = [];
  private lastFetchTime = 0;
  private CACHE_DURATION = 1000 * 60 * 60; // cache for 1 hour

  private constructor() {
    this.initializeClients();
  }

  static getInstance(): MCPRegistry {
    if (!MCPRegistry.instance) {
      MCPRegistry.instance = new MCPRegistry();
    }
    return MCPRegistry.instance;
  }

  private initializeClients() {
    for (const server of mcpConfig.servers) {
      this.clients.set(server.name, new MCPClient(server));
      console.log(`[MCPRegistry] Registered server: ${server.name}`);
    }
  }

  /**
   * Get all available tools (Local + MCP)
   */
  async getAllTools(forceRefresh = false): Promise<ToolDefinition[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedTools.length > 0 && now - this.lastFetchTime < this.CACHE_DURATION) {
      return this.cachedTools;
    }

    // 1. Convert Local Tools to generic definition
    // Local tools in `tools.ts` have `input_schema` and `handler`.
    const formattedLocalTools: ToolDefinition[] = localTools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema
    }));

    // 2. Fetch Remote Tools
    let remoteTools: ToolDefinition[] = [];
    const clientPromises = Array.from(this.clients.values()).map(client => client.listTools());

    const results = await Promise.allSettled(clientPromises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        remoteTools.push(...result.value);
      } else {
        console.error(`[MCPRegistry] Failed to fetch tools from client:`, result.reason);
      }
    });

    // 3. Merge
    this.cachedTools = [...formattedLocalTools, ...remoteTools];
    this.lastFetchTime = now;

    console.log(`[MCPRegistry] Total tools available: ${this.cachedTools.length} (${formattedLocalTools.length} local, ${remoteTools.length} remote)`);
    return this.cachedTools;
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName: string, args: any): Promise<any> {
    // 1. Check Local Tools first
    const localTool = localTools.find(t => t.name === toolName);
    if (localTool) {
      console.log(`[MCPRegistry] Executing Local Tool: ${toolName}`);
      return await localTool.handler(args);
    }

    // 2. Check Remote Tools (Broadcasting to find who owns it)
    for (const client of this.clients.values()) {
      try {
        return await client.callTool(toolName, args);
      } catch (err) {
        // Continue to next client if not found
      }
    }

    throw new Error(`Tool '${toolName}' not found.`);
  }

  /**
   * Get a list of dynamic keywords derived from available tools.
   * This allows the agent to "listen" for relevant topics.
   */
  async getDynamicKeywords(): Promise<string[]> {
    // Ensure tools are loaded
    await this.getAllTools();

    const vocabulary = new Set<string>();
    const stopWords = new Set(["get", "create", "list", "update", "delete", "a", "an", "the", "to", "for"]);

    this.cachedTools.forEach(tool => {
      // Split tool name by underscore or camelCase
      const parts = tool.name.split(/_|(?=[A-Z])/).map(s => s.toLowerCase());

      parts.forEach(part => {
        if (part.length > 2 && !stopWords.has(part)) {
          vocabulary.add(part);
        }
      });
    });

    // Add standard banking keywords that might not be in tool names
    const hardcodedDefaults = ["send", "withdraw", "transfer", "pay", "buy", "balance", "deposit"];
    hardcodedDefaults.forEach(w => vocabulary.add(w));

    return Array.from(vocabulary);
  }
}
