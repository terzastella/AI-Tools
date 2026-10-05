import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { webFetchLogic, WEB_FETCH_VERSION, type WebFetchInput, type WebFetchOutput } from "./logic.js";
import { webFetchPermissions } from "./permissions.js";

export const webFetchDefinition: ToolDefinition<WebFetchInput, WebFetchOutput> = {
  name: "web_fetch",
  label: "Web fetch",
  description: "Scarica una pagina pubblica (solo http/https, no host privati) e la rende testo con budget. Per docs e API.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string" },
      maxChars: { type: "number", description: "500..100000, default 20000" },
      extract: { type: "string", enum: ["text", "markdown", "html"] },
      timeoutMs: { type: "number", description: "5000..60000, default 20000" },
    },
    required: ["url"],
    additionalProperties: false,
  },
  permissions: webFetchPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: WEB_FETCH_VERSION, since: "0.14.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<WebFetchOutput>> {
    return withTiming("web_fetch", WEB_FETCH_VERSION, () => webFetchLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "FETCH_FAILED", message: err.message ?? String(e) };
    });
  },
};
