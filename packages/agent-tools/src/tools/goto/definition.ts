import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { gotoLogic, GOTO_VERSION, type GotoInput, type GotoOutput } from "./logic.js";
import { gotoPermissions } from "./permissions.js";

export const gotoDefinition: ToolDefinition<GotoInput, GotoOutput> = {
  name: "go_to_definition",
  label: "Go to definition",
  description: "Segue il filo fino a dove nasce un simbolo: export function/const/class/interface. Prima gli import del file chiamante.",
  category: "search",
  parameters: {
    type: "object",
    properties: {
      symbol: { type: "string" },
      fromFile: { type: "string" },
      paths: { type: "array" },
      maxResults: { type: "number" },
    },
    required: ["symbol"],
    additionalProperties: false,
  },
  permissions: gotoPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: GOTO_VERSION, since: "0.8.5" },
  async execute({ args, ctx }): Promise<AgentToolResult<GotoOutput>> {
    return withTiming("go_to_definition", GOTO_VERSION, () => gotoLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "GOTO_FAILED", message: err.message ?? String(e) };
    });
  },
};
