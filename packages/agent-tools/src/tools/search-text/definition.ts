import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { searchTextLogic, SEARCH_TEXT_VERSION, type SearchTextInput, type SearchTextOutput } from "./logic.js";
import { searchTextPermissions } from "./permissions.js";

export const searchTextDefinition: ToolDefinition<SearchTextInput, SearchTextOutput> = {
  name: "search_text",
  label: "Search text",
  description: "Cerca con espressione regolare dentro i file. Torna riga, colonna e snippet. Solo lettura.",
  category: "search",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regex JS, es. TODO|FIXME" },
      paths: { type: "array", description: "Default ['.']" },
      include: { type: "string", description: "Glob file, es. *.ts" },
      maxMatches: { type: "number", description: "1..200, default 50" },
      contextLines: { type: "number", description: "0..3, default 0" },
    },
    required: ["pattern"],
    additionalProperties: false,
  },
  permissions: searchTextPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: SEARCH_TEXT_VERSION, since: "0.10.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<SearchTextOutput>> {
    return withTiming("search_text", SEARCH_TEXT_VERSION, () => searchTextLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "SEARCH_FAILED", message: err.message ?? String(e) };
    });
  },
};
