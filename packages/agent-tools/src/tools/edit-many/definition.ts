import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { editManyLogic, EDIT_MANY_VERSION, type EditManyInput, type EditManyOutput } from "./logic.js";
import { editManyPermissions } from "./permissions.js";

export const editManyDefinition: ToolDefinition<EditManyInput, EditManyOutput> = {
  name: "edit_many",
  label: "Edit many",
  description: "Applica fino a 20 modifiche in un colpo solo, atomico: o tutte o nessuna. Rifiuta match ambigui.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      edits: {
        type: "array",
        description: "Lista {path, oldString, newString, replaceAll?}, max 20",
      },
      dryRun: { type: "boolean", description: "Default false" },
    },
    required: ["edits"],
    additionalProperties: false,
  },
  permissions: editManyPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: EDIT_MANY_VERSION, since: "0.10.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<EditManyOutput>> {
    return withTiming("edit_many", EDIT_MANY_VERSION, () => editManyLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "EDIT_FAILED", message: err.message ?? String(e) };
    });
  },
};
