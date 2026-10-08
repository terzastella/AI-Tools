import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { moveLogic, MOVE_VERSION, type MoveInput, type MoveOutput } from "./logic.js";
import { movePermissions } from "./permissions.js";

export const moveDefinition: ToolDefinition<MoveInput, MoveOutput> = {
  name: "move_file",
  label: "Move file",
  description: "Sposta/copia/cancella file e cartelle dentro cwd. Blocca traversal, rifiuta overwrite senza flag.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      op: { type: "string", enum: ["move", "copy", "delete"] },
      from: { type: "string" },
      to: { type: "string" },
      overwrite: { type: "boolean" },
      mkdirs: { type: "boolean" },
    },
    required: ["op", "from"],
    additionalProperties: false,
  },
  permissions: movePermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: MOVE_VERSION, since: "0.8.7" },
  async execute({ args, ctx }): Promise<AgentToolResult<MoveOutput>> {
    return withTiming(
      "move_file",
      MOVE_VERSION,
      () => moveLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "MOVE_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
