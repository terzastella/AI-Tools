import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { lintFixLogic, LINT_FIX_VERSION, type LintFixInput, type LintFixOutput } from "./logic.js";
import { lintFixPermissions } from "./permissions.js";

export const lintFixDefinition: ToolDefinition<LintFixInput, LintFixOutput> = {
  name: "lint_fix",
  label: "Lint fix",
  description: "Esegue eslint --fix sui path dati (solo JS/TS dentro cwd). format_check controlla, questo ripara. Serve sempre accept umano.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      paths: { type: "array", description: "File JS/TS dentro cwd, max 20" },
      timeoutMs: { type: "number", description: "10000..180000, default 60000" },
    },
    required: ["paths"],
    additionalProperties: false,
  },
  permissions: lintFixPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: LINT_FIX_VERSION, since: "0.13.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<LintFixOutput>> {
    return withTiming("lint_fix", LINT_FIX_VERSION, () => lintFixLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "LINT_FAILED", message: err.message ?? String(e) };
    });
  },
};
