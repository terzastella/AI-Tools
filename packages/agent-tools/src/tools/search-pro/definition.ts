import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { searchProLogic, SEARCH_PRO_VERSION, type SearchProInput, type SearchProOutput } from "./logic.js";
import { searchProPermissions } from "./permissions.js";

export const searchProDefinition: ToolDefinition<SearchProInput, SearchProOutput> = {
  name: "search_pro",
  label: "Search pro",
  description: "Occhi migliori: cerca nei file con ranking (titolo prima, contenuto dopo) + snippet corti. Sostituisce la ricerca a caso.",
  category: "search",
  parameters: {
    type: "object",
    properties: { query: { type: "string" }, paths: { type: "array" }, maxFiles: { type: "number" }, maxSnippets: { type: "number" } },
    required: ["query"],
    additionalProperties: false,
  },
  permissions: searchProPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: SEARCH_PRO_VERSION, since: "0.8.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<SearchProOutput>> {
    return withTiming("search_pro", SEARCH_PRO_VERSION, () => searchProLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "SEARCH_FAILED", message: err.message ?? String(e) };
    });
  },
};
