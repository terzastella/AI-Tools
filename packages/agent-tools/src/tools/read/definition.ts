import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { readLogic, READ_VERSION, type ReadInput, type ReadOutput } from "./logic.js";
import { readPermissions } from "./permissions.js";

export const readDefinition: ToolDefinition<ReadInput, ReadOutput> = {
  name: "read_file",
  label: "Read file",
  description: "Legge un file a pezzi: path + offset 1-based + limit max 1000. Solo lettura, blocca traversal.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path relativo al cwd" },
      offset: { type: "number", description: "Riga iniziale 1-based, default 1" },
      limit: { type: "number", description: "Max righe 1..1000, default 200" },
    },
    required: ["path"],
    additionalProperties: false,
  },
  permissions: readPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: READ_VERSION, since: "0.8.3" },
  async execute({ args, ctx }): Promise<AgentToolResult<ReadOutput>> {
    return withTiming(
      "read_file",
      READ_VERSION,
      () => readLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "READ_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
