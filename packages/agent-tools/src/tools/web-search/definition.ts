import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { webSearchLogic, WEB_SEARCH_VERSION, type WebSearchInput, type WebSearchOutput } from "./logic.js";
import { webSearchPermissions } from "./permissions.js";

export const webSearchDefinition: ToolDefinition<WebSearchInput, WebSearchOutput> = {
  name: "web_search",
  label: "Web search",
  description: "Cerca sul web (default DuckDuckGo senza chiavi) e torna titolo+url. Best-effort: il layout può cambiare.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string" },
      topK: { type: "number", description: "1..20, default 5" },
      endpoint: { type: "string", description: "Solo per test, default DuckDuckGo" },
      timeoutMs: { type: "number", description: "5000..60000, default 20000" },
    },
    required: ["query"],
    additionalProperties: false,
  },
  permissions: webSearchPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: WEB_SEARCH_VERSION, since: "0.14.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<WebSearchOutput>> {
    return withTiming("web_search", WEB_SEARCH_VERSION, () => webSearchLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "SEARCH_FAILED", message: err.message ?? String(e) };
    });
  },
};
