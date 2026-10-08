import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { preparerLogic, PREPARER_VERSION, type PreparerInput, type PreparerOutput } from "./logic.js";
import { preparerPermissions } from "./permissions.js";

export const preparerDefinition: ToolDefinition<PreparerInput, PreparerOutput> = {
  name: "prepare_context",
  label: "Prepare context",
  description:
    "Pre-tool deterministico: esplora lo scope, trova i file rilevanti per il goal (keyword score), ritorna snippet troncati e uno scaffold di plan per create_file/edit_file. Sola lettura.",
  category: "search",
  parameters: {
    type: "object",
    properties: {
      goal: { type: "string", description: "Obiettivo in testo libero, es. 'add retry to writer'" },
      paths: { type: "array", description: "Scope relativo al cwd, default ['.']" },
      includeGlobs: { type: "array", description: "Es. ['src/**/*.ts']" },
      excludeGlobs: { type: "array", description: "Es. ['**/*.test.ts']" },
      maxFiles: { type: "number", description: "Default 20, max 100" },
      maxBytesPerFile: { type: "number", description: "Default 20000" },
    },
    required: ["goal"],
    additionalProperties: false,
  },
  permissions: preparerPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: PREPARER_VERSION, since: "0.2.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<PreparerOutput>> {
    return withTiming(
      "prepare_context",
      PREPARER_VERSION,
      () => preparerLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "PREPARER_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
