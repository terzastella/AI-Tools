import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { budgetStatusLogic, BUDGET_STATUS_VERSION, type BudgetStatusInput, type BudgetStatusOutput } from "./logic.js";
import { budgetStatusPermissions } from "./permissions.js";

export const budgetStatusDefinition: ToolDefinition<BudgetStatusInput, BudgetStatusOutput> = {
  name: "budget_status",
  label: "Budget status",
  description:
    "Contatore token globale (args+result di ogni tool avvolto): status e reset. Il tetto si imposta con ctx.budgetLimit, oltre scatta BUDGET_EXCEEDED.",
  category: "other",
  parameters: {
    type: "object",
    properties: { op: { type: "string", enum: ["status", "reset"] } },
    required: ["op"],
    additionalProperties: false,
  },
  permissions: budgetStatusPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: BUDGET_STATUS_VERSION, since: "0.16.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<BudgetStatusOutput>> {
    return withTiming(
      "budget_status",
      BUDGET_STATUS_VERSION,
      () => budgetStatusLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "BUDGET_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
