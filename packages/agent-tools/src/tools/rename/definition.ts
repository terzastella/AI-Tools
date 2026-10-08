import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { renameLogic, RENAME_VERSION, type RenameInput, type RenameOutput } from "./logic.js";
import { renamePermissions } from "./permissions.js";

export const renameDefinition: ToolDefinition<RenameInput, RenameOutput> = {
  name: "rename_symbol",
  label: "Rename symbol",
  description: "Rinomina un simbolo whole-word in tutto lo scope. Salta node_modules/dist. Supporta dryRun.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      oldName: { type: "string" },
      newName: { type: "string" },
      paths: { type: "array" },
      includeGlobs: { type: "array" },
      dryRun: { type: "boolean" },
    },
    required: ["oldName", "newName"],
    additionalProperties: false,
  },
  permissions: renamePermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: RENAME_VERSION, since: "0.8.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<RenameOutput>> {
    return withTiming(
      "rename_symbol",
      RENAME_VERSION,
      () => renameLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "RENAME_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
