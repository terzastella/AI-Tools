import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { inspectSymbolLogic, INSPECT_SYMBOL_VERSION, type InspectSymbolInput, type InspectSymbolOutput } from "./logic.js";
import { inspectSymbolPermissions } from "./permissions.js";

export const inspectSymbolDefinition: ToolDefinition<InspectSymbolInput, InspectSymbolOutput> = {
  name: "inspect_symbol",
  label: "Inspect symbol",
  description: "Info mirata su un simbolo in un file: definizione, tipo, contesto. Solo lettura, veloce.",
  category: "search",
  parameters: {
    type: "object",
    properties: {
      symbol: { type: "string" },
      path: { type: "string" },
      line: { type: "number" },
    },
    required: ["symbol", "path"],
    additionalProperties: false,
  },
  permissions: inspectSymbolPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: INSPECT_SYMBOL_VERSION, since: "0.10.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<InspectSymbolOutput>> {
    return withTiming("inspect_symbol", INSPECT_SYMBOL_VERSION, () => inspectSymbolLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "INSPECT_FAILED", message: err.message ?? String(e) };
    });
  },
};
