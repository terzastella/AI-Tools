import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { mcpCallLogic, MCP_CALL_VERSION, type McpCallInput, type McpCallOutput } from "./logic.js";
import { mcpCallPermissions } from "./permissions.js";

export const mcpCallDefinition: ToolDefinition<McpCallInput, McpCallOutput> = {
  name: "mcp_call",
  label: "MCP call",
  description: "Chiama un tool di un server MCP via stdio (initialize + tools/list + tools/call). Config in mcp-servers.json. Serve sempre accept umano.",
  category: "mcp",
  parameters: {
    type: "object",
    properties: {
      server: { type: "string", description: "Nome in mcp.servers, es. web" },
      tool: { type: "string", description: "Nome tool del server, es. fetch" },
      args: { type: "object", description: "Default {}" },
      timeoutMs: { type: "number", description: "5000..120000, default 30000" },
      config: { type: "string", description: "Path config relativo a cwd, default mcp-servers.json" },
    },
    required: ["server", "tool"],
    additionalProperties: false,
  },
  permissions: mcpCallPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: MCP_CALL_VERSION, since: "0.12.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<McpCallOutput>> {
    return withTiming("mcp_call", MCP_CALL_VERSION, () => mcpCallLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "MCP_FAILED", message: err.message ?? String(e) };
    });
  },
};
