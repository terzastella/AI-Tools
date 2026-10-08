import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { packContextLogic, PACK_CONTEXT_VERSION, type PackContextInput, type PackContextOutput } from "./logic.js";
import { packContextPermissions } from "./permissions.js";

export const packContextDefinition: ToolDefinition<PackContextInput, PackContextOutput> = {
  name: "pack_context",
  label: "Pack context",
  description:
    "Concatena file con header === path === rispettando un budget chars. Legge solo dentro cwd, salta binari. Port nativo di context_pack.py.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      paths: { type: "array", description: "File o cartelle relative a cwd, max 50" },
      max_chars: { type: "number", description: "500..200000, default 12000" },
    },
    required: ["paths"],
    additionalProperties: false,
  },
  permissions: packContextPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: PACK_CONTEXT_VERSION, since: "0.11.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<PackContextOutput>> {
    return withTiming(
      "pack_context",
      PACK_CONTEXT_VERSION,
      () => packContextLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "PACK_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
