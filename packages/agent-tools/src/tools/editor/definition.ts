import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { editorLogic, EDITOR_VERSION, type EditorInput, type EditorOutput } from "./logic.js";
import { editorPermissions } from "./permissions.js";

export const editorDefinition: ToolDefinition<EditorInput, EditorOutput> = {
  name: "edit_file",
  label: "Edit file",
  description:
    "Modifica chirurgica su file esistente: replace esatto, insertAt per linea, deleteRange. Rifiuta match ambigui senza replaceAll.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string" },
      mode: { type: "string", enum: ["replace", "insertAt", "deleteRange"] },
      oldString: { type: "string" },
      newString: { type: "string" },
      replaceAll: { type: "boolean" },
      line: { type: "number" },
      content: { type: "string" },
      startLine: { type: "number" },
      endLine: { type: "number" },
      backup: { type: "boolean" },
      dryRun: { type: "boolean" },
    },
    required: ["path"],
    additionalProperties: false,
  },
  permissions: editorPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: EDITOR_VERSION, since: "0.1.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<EditorOutput>> {
    return withTiming(
      "edit_file",
      EDITOR_VERSION,
      () => editorLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "EDITOR_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
