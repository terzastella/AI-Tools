import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { astSearchLogic, AST_SEARCH_VERSION, type AstSearchInput, type AstSearchOutput } from "./logic.js";
import { astSearchPermissions } from "./permissions.js";

export const astSearchDefinition: ToolDefinition<AstSearchInput, AstSearchOutput> = {
  name: "ast_search",
  label: "AST search",
  description: "Cerca simboli strutturali (function/class/interface/import) invece di testo grezzo. Usa AST TypeScript quando disponibile, regex mirati altrimenti.",
  category: "search",
  parameters: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Filtro nome, vuoto = tutti" },
      kind: { type: "string", enum: ["function", "class", "interface", "import", "all"] },
      paths: { type: "array", description: "Default ['.'], max 20" },
      lang: { type: "string", enum: ["ts", "js", "py", "auto"] },
      maxResults: { type: "number", description: "1..200, default 50" },
    },
    required: [],
    additionalProperties: false,
  },
  permissions: astSearchPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: AST_SEARCH_VERSION, since: "0.14.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<AstSearchOutput>> {
    return withTiming("ast_search", AST_SEARCH_VERSION, () => astSearchLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "AST_FAILED", message: err.message ?? String(e) };
    });
  },
};
