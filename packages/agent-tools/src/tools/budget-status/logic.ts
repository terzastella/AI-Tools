import { readUsage, resetUsage } from "../../core/budget.js";
import type { ToolContext } from "../../core/context.js";

export interface BudgetStatusInput {
  op: "status" | "reset";
}

export interface BudgetStatusOutput {
  op: string;
  used: number;
  calls: number;
  limit: number | null;
  remaining: number | null;
  cleared?: number;
}

export const BUDGET_STATUS_VERSION = "1.0.0";

export async function budgetStatusLogic(ctx: ToolContext, input: BudgetStatusInput): Promise<BudgetStatusOutput> {
  const op = input.op ?? "";
  if (op === "status") {
    const { used, calls } = await readUsage(ctx.cwd);
    const limit = ctx.budgetLimit ?? null;
    return { op, used, calls, limit, remaining: limit === null ? null : Math.max(0, limit - used) };
  }
  if (op === "reset") {
    const before = await resetUsage(ctx.cwd);
    const limit = ctx.budgetLimit ?? null;
    return { op, used: 0, calls: 0, limit, remaining: limit, cleared: before.calls };
  }
  throw Object.assign(new Error(`unknown op: ${op} (status|reset)`), { code: "BAD_ARGS" });
}
