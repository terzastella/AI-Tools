import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { fileOutlineLogic, FILE_OUTLINE_VERSION, type FileOutlineInput, type FileOutlineOutput } from "./logic.js";
import { fileOutlinePermissions } from "./permissions.js";

export const fileOutlineDefinition: ToolDefinition<FileOutlineInput, FileOutlineOutput> = {
  name: "file_outline",
  label: "File outline",
  description: "Indice di un file: funzioni, classi, interfacce con riga. Solo lettura, senza aprire tutto il file.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string" },
      maxSymbols: { type: "number", description: "1..500, default 100" },
    },
    required: ["path"],
    additionalProperties: false,
  },
  permissions: fileOutlinePermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: FILE_OUTLINE_VERSION, since: "0.10.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<FileOutlineOutput>> {
    return withTiming(
      "file_outline",
      FILE_OUTLINE_VERSION,
      () => fileOutlineLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "OUTLINE_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
