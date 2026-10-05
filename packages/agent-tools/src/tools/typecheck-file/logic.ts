import type { ToolContext } from "../../core/context.js";
import { resolveSafePath } from "../../core/context.js";
import { diagnoseLogic, type DiagnoseIssue } from "../diagnose/logic.js";

export interface TypecheckFileInput {
  paths: string[];
  timeoutMs?: number;
}

export interface TypecheckFileOutput {
  issues: DiagnoseIssue[];
  summary: { total: number; filtered: number };
  files: string[];
}

export const TYPECHECK_FILE_VERSION = "1.0.0";

export async function typecheckFileLogic(ctx: ToolContext, input: TypecheckFileInput): Promise<TypecheckFileOutput> {
  const rawPaths = input.paths ?? [];
  if (!Array.isArray(rawPaths) || rawPaths.length === 0 || rawPaths.length > 10) {
    throw Object.assign(new Error("paths must be 1..10 files"), { code: "BAD_ARGS" });
  }
  const normalized: string[] = [];
  for (const p of rawPaths) {
    const rel = (p ?? "").trim().replace(/\\/g, "/");
    if (!rel) throw Object.assign(new Error("empty path"), { code: "BAD_ARGS" });
    const r = resolveSafePath(ctx, rel);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
    normalized.push(rel.replace(/^\.\//, ""));
  }
  const diag = await diagnoseLogic(ctx, {
    ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
  });
  const wanted = new Set(normalized.map((p) => p.toLowerCase()));
  const filtered = diag.issues.filter((i) => {
    if (i.source !== "tsc") return false;
    if (!i.path) return false;
    const ip = i.path.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
    if (wanted.has(ip)) return true;
    return [...wanted].some((w) => ip.endsWith(`/${w}`) || ip === w);
  });
  return { issues: filtered.slice(0, 100), summary: { total: diag.issues.filter((i) => i.source === "tsc").length, filtered: filtered.length }, files: normalized };
}
