import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { lspBridgeLogic, LSP_BRIDGE_VERSION, type LspBridgeInput, type LspBridgeOutput } from "./logic.js";
import { lspBridgePermissions } from "./permissions.js";

export const lspBridgeDefinition: ToolDefinition<LspBridgeInput, LspBridgeOutput> = {
  name: "lsp_bridge",
  label: "LSP bridge",
  description: "Vero linguaggio-server TypeScript: hover (tipo), references cross-file, rename dry (propone modifiche, non applica). Se manca typescript usa goto/refs.",
  category: "search",
  parameters: {
    type: "object",
    properties: {
      op: { type: "string", enum: ["hover", "references", "rename"] },
      path: { type: "string" },
      line: { type: "number", description: "1-based" },
      character: { type: "number", description: "1-based, default da symbol" },
      symbol: { type: "string", description: "Per trovare la colonna sulla riga" },
      newName: { type: "string", description: "Per rename" },
      maxResults: { type: "number", description: "1..200, default 50" },
    },
    required: ["op", "path", "line"],
    additionalProperties: false,
  },
  permissions: lspBridgePermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: LSP_BRIDGE_VERSION, since: "0.16.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<LspBridgeOutput>> {
    return withTiming("lsp_bridge", LSP_BRIDGE_VERSION, () => lspBridgeLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "LSP_FAILED", message: err.message ?? String(e) };
    });
  },
};
