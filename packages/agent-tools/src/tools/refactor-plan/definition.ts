import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { refactorPlanLogic, REFACTOR_PLAN_VERSION, type RefactorPlanInput, type RefactorPlanOutput } from "./logic.js";
import { refactorPlanPermissions } from "./permissions.js";

export const refactorPlanDefinition: ToolDefinition<RefactorPlanInput, RefactorPlanOutput> = {
  name: "refactor_plan",
  label: "Refactor plan",
  description: "Piano furbo ma semplice: occhi (search) + puzze stile + errori tsc veri. Sceglie edit/patch/rename e hint con riga. Non esegue, propone.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      goal: { type: "string" },
      paths: { type: "array" },
      maxSteps: { type: "number" },
    },
    required: ["goal"],
    additionalProperties: false,
  },
  permissions: refactorPlanPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: REFACTOR_PLAN_VERSION, since: "0.6.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<RefactorPlanOutput>> {
    return withTiming("refactor_plan", REFACTOR_PLAN_VERSION, () => refactorPlanLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "REFACTOR_FAILED", message: err.message ?? String(e) };
    });
  },
};
