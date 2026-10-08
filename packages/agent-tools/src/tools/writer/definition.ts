import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { writerLogic, WRITER_VERSION, type WriterInput, type WriterOutput } from "./logic.js";
import { writerPermissions } from "./permissions.js";

export const writerDefinition: ToolDefinition<WriterInput, WriterOutput> = {
  name: "create_file",
  label: "Create file",
  description:
    "Crea un file da zero con scrittura atomica. Rifiuta overwrite salvo flag, blocca path traversal, supporta dry-run.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path relativo al cwd, es. src/hello.ts" },
      content: { type: "string", description: "Contenuto completo del file" },
      overwrite: { type: "boolean", description: "Default false" },
      mkdirs: { type: "boolean", description: "Crea directory parent, default true" },
      dryRun: { type: "boolean", description: "Se true non scrive, default false" },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },
  permissions: writerPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: WRITER_VERSION, since: "0.1.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<WriterOutput>> {
    return withTiming(
      "create_file",
      WRITER_VERSION,
      () => writerLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "WRITER_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
