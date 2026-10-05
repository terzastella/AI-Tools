import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { diagnoseLogic, DIAGNOSE_VERSION, type DiagnoseInput, type DiagnoseOutput } from "./logic.js";
import { diagnosePermissions } from "./permissions.js";

export const diagnoseDefinition: ToolDefinition<DiagnoseInput, DiagnoseOutput> = {
  name: "diagnose",
  label: "Diagnose",
  description: "Dottore vero: lancia tsc --noEmit sempre + eslint se presente + vitest solo se runTests:true. Ritorna issue strutturate.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      paths: { type: "array" },
      runTests: { type: "boolean" },
      testPattern: { type: "string" },
      timeoutMs: { type: "number" },
    },
    required: [],
    additionalProperties: false,
  },
  permissions: diagnosePermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: DIAGNOSE_VERSION, since: "0.8.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<DiagnoseOutput>> {
    return withTiming("diagnose", DIAGNOSE_VERSION, () => diagnoseLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "DIAGNOSE_FAILED", message: err.message ?? String(e) };
    });
  },
};
