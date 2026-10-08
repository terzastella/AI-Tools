import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { importMapLogic, IMPORT_MAP_VERSION, type ImportMapInput, type ImportMapOutput } from "./logic.js";
import { importMapPermissions } from "./permissions.js";

export const importMapDefinition: ToolDefinition<ImportMapInput, ImportMapOutput> = {
  name: "import_map",
  label: "Import map",
  description: "Mappa chi importa cosa (solo import relativi + nomi pacchetti). Solo lettura, utile prima di move.",
  category: "search",
  parameters: {
    type: "object",
    properties: {
      paths: { type: "array", description: "Default ['src']" },
      maxFiles: { type: "number", description: "1..500, default 100" },
    },
    required: [],
    additionalProperties: false,
  },
  permissions: importMapPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: IMPORT_MAP_VERSION, since: "0.10.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<ImportMapOutput>> {
    return withTiming(
      "import_map",
      IMPORT_MAP_VERSION,
      () => importMapLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "IMPORTMAP_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
