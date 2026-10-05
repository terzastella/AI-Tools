import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { refsLogic, REFS_VERSION, type RefsInput, type RefsOutput } from "./logic.js";
import { refsPermissions } from "./permissions.js";

export const refsDefinition: ToolDefinition<RefsInput, RefsOutput> = {
  name: "find_references",
  label: "Find references",
  description: "Trova tutti i posti dove viene usato un simbolo (non la definizione). Per non rompere niente quando cambi.",
  category: "search",
  parameters: {
    type: "object",
    properties: { symbol: { type: "string" }, paths: { type: "array" }, maxFiles: { type: "number" }, maxMatches: { type: "number" } },
    required: ["symbol"],
    additionalProperties: false,
  },
  permissions: refsPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: REFS_VERSION, since: "0.8.6" },
  async execute({ args, ctx }): Promise<AgentToolResult<RefsOutput>> {
    return withTiming("find_references", REFS_VERSION, () => refsLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "REFS_FAILED", message: err.message ?? String(e) };
    });
  },
};
