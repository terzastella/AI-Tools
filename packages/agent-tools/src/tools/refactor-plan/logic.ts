import { resolveSafePath, type ToolContext } from "../../core/context.js";
import { searchProLogic } from "../search-pro/logic.js";
import { reviewerLogic } from "../reviewer/logic.js";
import { diagnoseLogic } from "../diagnose/logic.js";

export interface RefactorPlanInput {
  goal: string;
  paths?: string[];
  maxSteps?: number;
}

export interface RefactorStep {
  kind: "create" | "edit" | "patch" | "rename";
  path: string;
  hint: string;
  priority: number;
}

export interface RefactorPlanOutput {
  goal: string;
  steps: RefactorStep[];
  risks: string[];
}

export const REFACTOR_PLAN_VERSION = "1.1.0";

export async function refactorPlanLogic(ctx: ToolContext, input: RefactorPlanInput): Promise<RefactorPlanOutput> {
  const goal = (input.goal ?? "").trim();
  if (!goal) throw Object.assign(new Error("goal is required"), { code: "BAD_ARGS" });
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["src"];
  const maxSteps = input.maxSteps ?? 5;
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 20) {
    throw Object.assign(new Error("maxSteps must be 1..20"), { code: "BAD_ARGS" });
  }
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
  }

  // Occhi buoni + revisore acceso + dottore diretto (equilibrato, non eccessivo)
  const [search, rev] = await Promise.all([
    searchProLogic(ctx, { query: goal, paths: rawPaths, maxFiles: maxSteps * 2 }).catch(() => ({
      query: goal,
      hits: [],
      truncated: false,
    })),
    reviewerLogic(ctx, { paths: rawPaths, maxFiles: maxSteps * 2, useDiagnose: true }).catch(() => ({
      issues: [],
      summary: { files: 0, errors: 0, warnings: 0, infos: 0 },
      truncated: false,
      diagnosed: false,
    })),
  ]);

  const tscCount = new Map<string, { count: number; first?: string; line?: number }>();
  try {
    const diag = await diagnoseLogic(ctx, { paths: rawPaths });
    for (const d of diag.issues) {
      if (d.source !== "tsc" || !d.path) continue;
      const e = tscCount.get(d.path) ?? { count: 0 };
      e.count++;
      if (e.first === undefined) {
        e.first = d.message;
        if (d.line !== undefined) e.line = d.line;
      }
      tscCount.set(d.path, e);
    }
  } catch {
    /* dottore best-effort */
  }

  const smell = new Map<string, { score: number; secrets: boolean; tests: boolean }>();
  for (const i of rev.issues) {
    const s = smell.get(i.path) ?? { score: 0, secrets: false, tests: false };
    s.score += i.severity === "error" ? 3 : i.severity === "warning" ? 2 : 1;
    if (i.rule === "secret-like") s.secrets = true;
    smell.set(i.path, s);
  }

  const goalLow = goal.toLowerCase();
  const wantsRename = goalLow.includes("rinomina") || goalLow.includes("rename") || goalLow.includes("rénomina");

  const steps: RefactorStep[] = [];
  for (const h of search.hits.slice(0, maxSteps * 2)) {
    const sm = smell.get(h.path) ?? { score: 0, secrets: false, tests: false };
    const t = tscCount.get(h.path) ?? { count: 0 };
    // Peso equilibrato: tsc ×5 (non ×10), smell ×2
    const priority = h.score + sm.score * 2 + t.count * 5;

    // Conta problemi in questo file per scegliere patch vs edit
    const issuesHere = rev.issues.filter((i) => i.path === h.path).length;
    let kind: RefactorStep["kind"] = "edit";
    if (wantsRename && issuesHere <= 2) kind = "rename";
    else if (issuesHere >= 3 || t.count >= 2) kind = "patch";

    const detail = t.first
      ? `${h.path}${t.line ? " riga " + t.line : ""} — ${t.first.slice(0, 100)}`
      : sm.score > 0
        ? `${h.path} — ${sm.score} puzze stile`
        : `${h.path} — simile al goal`;
    const tool = kind === "patch" ? "apply_patch" : kind === "rename" ? "rename_symbol" : "edit_file";
    steps.push({
      kind,
      path: h.path,
      hint: `Per "${goal.slice(0, 80)}": ${detail}. Apri e fai ${tool}.`,
      priority,
    });
    if (h.path.endsWith(".test.ts") || h.path.includes("test")) {
      const s = smell.get(h.path) ?? { score: 0, secrets: false, tests: false };
      s.tests = true;
      smell.set(h.path, s);
    }
  }

  steps.sort((a, b) => b.priority - a.priority);
  const top = steps.slice(0, maxSteps);

  const risks: string[] = [];
  if ([...smell.values()].some((s) => s.secrets))
    risks.push("Attenzione: tocchi possibili secrets — spostali in env, non committarli.");
  if (top.some((s) => s.path.endsWith(".test.ts"))) risks.push("Tocca test: lancia vitest dopo ogni modifica.");
  if (search.truncated) risks.push("Troppi file: restringi paths o alza maxSteps.");
  if (top.length === 0) risks.push("Nessun candidato — allarga goal o paths.");
  if (rev.summary.errors > 0 && top.length > 0)
    risks.push(`${rev.summary.errors} errori da review — sistema prima errori/secrets.`);

  ctx.logger.info("refactor_plan", { goal: goal.slice(0, 80), steps: top.length });
  return { goal, steps: top, risks };
}
