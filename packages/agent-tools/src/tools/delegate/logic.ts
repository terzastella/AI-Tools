import { resolveSafePath, type ToolContext } from "../../core/context.js";
import { refactorPlanLogic } from "../refactor-plan/logic.js";
import { readLogic } from "../read/logic.js";
import { reviewerLogic } from "../reviewer/logic.js";
import { todoLogic } from "../todo/logic.js";

export interface DelegateInput {
  goal: string;
  paths?: string[];
  maxSteps?: number;
}

export interface DelegateStepResult {
  path: string;
  kind: string;
  verified: boolean;
  detail: string;
}

export interface DelegateOutput {
  goal: string;
  steps: DelegateStepResult[];
  todoIds: string[];
  summary: string;
}

export const DELEGATE_VERSION = "1.0.0";

export async function delegateLogic(ctx: ToolContext, input: DelegateInput): Promise<DelegateOutput> {
  const goal = (input.goal ?? "").trim();
  if (!goal) throw Object.assign(new Error("goal is required"), { code: "BAD_ARGS" });
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["src"];
  const maxSteps = input.maxSteps ?? 3;
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 10) {
    throw Object.assign(new Error("maxSteps must be 1..10"), { code: "BAD_ARGS" });
  }
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
  }

  // 1. Piano furbo (read-only)
  const plan = await refactorPlanLogic(ctx, { goal, paths: rawPaths, maxSteps });
  const steps: DelegateStepResult[] = [];
  const todoIds: string[] = [];

  // 2. Per ogni step: registra todo + verifica leggendo + review singolo file (tutto read-only, niente scritture)
  for (const s of plan.steps) {
    const added = await todoLogic(ctx, { action: "add", text: `${s.kind} ${s.path}: ${goal.slice(0, 80)}` });
    const created = added.todos[added.todos.length - 1]!;
    todoIds.push(created.id);

    let verified = false;
    let detail = s.hint;
    try {
      // verifica che il file esista e sia leggibile
      const read = await readLogic(ctx, { path: s.path, limit: 5 });
      // review veloce senza dottore per non rallentare (stile)
      const rev = await reviewerLogic(ctx, { paths: [s.path], maxFiles: 1, useDiagnose: false }).catch(() => ({
        issues: [],
      }));
      const issues = (rev as { issues: unknown[] }).issues.length;
      verified = read.totalLines > 0;
      detail = `${s.path}: ${read.totalLines} righe, ${issues} puzze stile. ${s.hint.slice(0, 120)}`;
    } catch (e) {
      detail = `Non leggibile ${s.path}: ${e instanceof Error ? e.message : String(e)}`;
    }
    steps.push({ path: s.path, kind: s.kind, verified, detail });
  }

  const verifiedCount = steps.filter((s) => s.verified).length;
  const summary = `Capo-cantiere: ${steps.length} passi, ${verifiedCount} verificati (leggibili). Prossimo: esegui edit/patch a mano partendo dal primo. Risks: ${(plan.risks[0] ?? "nessuno").slice(0, 120)}`;
  ctx.logger.info("delegate_task", { goal: goal.slice(0, 80), steps: steps.length, verified: verifiedCount });
  return { goal, steps, todoIds, summary };
}
