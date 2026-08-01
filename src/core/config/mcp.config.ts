export interface MCPServerConfig {
  name: string;
  baseUrl: string;
}

export const mcpConfig: { servers: MCPServerConfig[] } = {
  servers: [
    //  MongoDB config can be added here
    // {
    //   name: "mongodb",
    //   baseUrl: "http://localhost:3000/mcp", 
    // }
  ],
};
