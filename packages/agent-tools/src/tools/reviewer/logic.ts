import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";
import { diagnoseLogic } from "../diagnose/logic.js";

export type ReviewSeverity = "error" | "warning" | "info";
export type ReviewRule =
  | "long-line"
  | "no-console-log"
  | "todo-fixme"
  | "no-any"
  | "secret-like"
  | "missing-newline-eof"
  | "huge-file"
  | "tsc-error";

export interface ReviewerInput {
  paths?: string[];
  includeGlobs?: string[];
  excludeGlobs?: string[];
  maxFiles?: number;
  rules?: ReviewRule[];
  /** Se true (default) chiama anche diagnose reale e aggiunge errori tsc-error. */
  useDiagnose?: boolean;
}

export interface ReviewIssue {
  severity: ReviewSeverity;
  path: string;
  line?: number;
  rule: ReviewRule;
  message: string;
  suggestion?: string;
}

export interface ReviewerOutput {
  issues: ReviewIssue[];
  summary: { files: number; errors: number; warnings: number; infos: number };
  truncated: boolean;
  diagnosed: boolean;
}

export const REVIEWER_VERSION = "1.1.0";
export const ALL_RULES: ReviewRule[] = [
  "long-line",
  "no-console-log",
  "todo-fixme",
  "no-any",
  "secret-like",
  "missing-newline-eof",
  "huge-file",
  "tsc-error",
];

const DEFAULT_EXCLUDE_DIRS = new Set(["node_modules", "dist", ".git", "coverage", ".tmp-smoke", ".tmp-demo"]);
const HARD_FILE_LIMIT = 2000;

function matchGlob(fileRel: string, pattern: string): boolean {
  const rel = fileRel.replace(/\\/g, "/");
  const pat = pattern.replace(/\\/g, "/");
  if (pat === "**" || pat === "*" || pat === "**/*") return true;
  if (!pat.includes("*")) return rel === pat || rel.endsWith("/" + pat);
  const rx = new RegExp(
    "^" +
      pat
        .split("*")
        .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*") +
      "$",
  );
  return rx.test(rel) || rx.test(path.basename(rel));
}

function excludedRel(relPosix: string, excludeGlobs: string[]): boolean {
  if (relPosix.split("/").some((p) => DEFAULT_EXCLUDE_DIRS.has(p))) return true;
  return excludeGlobs.some((g) => matchGlob(relPosix, g));
}

async function walk(absDir: string, cwd: string, excludeGlobs: string[], out: string[]): Promise<void> {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  for (const e of entries) {
    if (out.length >= HARD_FILE_LIMIT) return;
    const abs = path.join(absDir, e.name);
    const rel = path.relative(cwd, abs).replace(/\\/g, "/");
    if (e.isDirectory()) {
      if (excludedRel(rel, excludeGlobs)) continue;
      await walk(abs, cwd, excludeGlobs, out);
    } else if (e.isFile()) {
      if (excludedRel(rel, excludeGlobs)) continue;
      out.push(abs);
    }
  }
}

const SECRET_RE = /(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*['"][^'"]{4,}['"]/i;

export async function reviewerLogic(ctx: ToolContext, input: ReviewerInput): Promise<ReviewerOutput> {
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["."];
  const maxFiles = input.maxFiles ?? 20;
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 100) {
    throw Object.assign(new Error("maxFiles must be 1..100"), { code: "BAD_ARGS" });
  }
  const rules = input.rules && input.rules.length > 0 ? input.rules : ALL_RULES;
  for (const r of rules) {
    if (!ALL_RULES.includes(r)) throw Object.assign(new Error(`unknown rule: ${r}`), { code: "BAD_ARGS" });
  }
  const ruleSet = new Set(rules);
  const includeGlobs = input.includeGlobs ?? [];
  const excludeGlobs = input.excludeGlobs ?? [];

  const absTargets: { abs: string; isDir: boolean }[] = [];
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
    let st: Awaited<ReturnType<typeof fs.stat>>;
    try {
      st = await fs.stat(r.abs);
    } catch {
      throw Object.assign(new Error(`path not found: ${p}`), { code: "NOT_FOUND" });
    }
    absTargets.push({ abs: r.abs, isDir: st.isDirectory() });
  }

  let candidates: string[] = [];
  for (const t of absTargets) {
    if (!t.isDir) candidates.push(t.abs);
    else await walk(t.abs, ctx.cwd, excludeGlobs, candidates);
  }
  if (includeGlobs.length > 0) {
    candidates = candidates.filter((abs) => {
      const rel = path.relative(ctx.cwd, abs).replace(/\\/g, "/");
      return includeGlobs.some((g) => matchGlob(rel, g));
    });
  }

  const truncated = candidates.length > maxFiles;
  const top = candidates.slice(0, maxFiles);
  const issues: ReviewIssue[] = [];
  let files = 0;

  for (const abs of top) {
    let st: Awaited<ReturnType<typeof fs.stat>>;
    try {
      st = await fs.stat(abs);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size > 500_000) continue;
    let content: string;
    try {
      content = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }
    if (content.includes("\0")) continue;
    files++;
    const rel = path.relative(ctx.cwd, abs).replace(/\\/g, "/");
    const lines = content.split("\n");

    if (ruleSet.has("huge-file") && lines.length > 2000) {
      issues.push({
        severity: "warning",
        path: rel,
        rule: "huge-file",
        message: `File has ${lines.length} lines (>2000)`,
        suggestion: "Split into smaller modules.",
      });
    }
    if (ruleSet.has("missing-newline-eof") && content.length > 0 && !content.endsWith("\n")) {
      issues.push({
        severity: "info",
        path: rel,
        line: lines.length,
        rule: "missing-newline-eof",
        message: "Missing newline at end of file.",
        suggestion: "End file with a newline.",
      });
    }
    const checkLine =
      ruleSet.has("long-line") ||
      ruleSet.has("no-console-log") ||
      ruleSet.has("todo-fixme") ||
      ruleSet.has("no-any") ||
      ruleSet.has("secret-like");
    if (checkLine) {
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i]!;
        const lineNo = i + 1;
        if (ruleSet.has("long-line") && ln.length > 120) {
          issues.push({
            severity: "info",
            path: rel,
            line: lineNo,
            rule: "long-line",
            message: `Line too long (${ln.length} > 120).`,
            suggestion: "Wrap or split the line.",
          });
        }
        if (ruleSet.has("no-console-log") && /console\.(log|debug|warn|error)/.test(ln)) {
          issues.push({
            severity: "warning",
            path: rel,
            line: lineNo,
            rule: "no-console-log",
            message: "console.* found.",
            suggestion: "Use the injected logger instead.",
          });
        }
        if (ruleSet.has("todo-fixme") && /(TODO|FIXME)/.test(ln)) {
          issues.push({
            severity: "info",
            path: rel,
            line: lineNo,
            rule: "todo-fixme",
            message: "TODO/FIXME marker found.",
            suggestion: "Track it or resolve it.",
          });
        }
        if (ruleSet.has("no-any") && rel.endsWith(".ts") && /:\s*any\b/.test(ln)) {
          issues.push({
            severity: "warning",
            path: rel,
            line: lineNo,
            rule: "no-any",
            message: "Explicit 'any' type.",
            suggestion: "Use a precise type or unknown.",
          });
        }
        if (ruleSet.has("secret-like") && SECRET_RE.test(ln)) {
          issues.push({
            severity: "error",
            path: rel,
            line: lineNo,
            rule: "secret-like",
            message: "Possible hardcoded secret.",
            suggestion: "Move to env vars.",
          });
        }
        if (issues.length > 500) break;
      }
    }
    if (issues.length > 500) break;
  }

  const summary = {
    files,
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    infos: issues.filter((i) => i.severity === "info").length,
  };

  // Dottore dentro: acceso di default come approvato
  let diagnosed = false;
  const useDiagnose = input.useDiagnose ?? true;
  if (useDiagnose && ruleSet.has("tsc-error")) {
    try {
      const diag = await diagnoseLogic(ctx, { paths: rawPaths });
      diagnosed = true;
      for (const d of diag.issues) {
        if (d.source !== "tsc") continue;
        const issue: ReviewIssue = {
          severity: "error",
          path: d.path ?? rawPaths[0] ?? ".",
          rule: "tsc-error",
          message: d.message,
          suggestion: "Fix type error.",
        };
        if (d.line !== undefined) issue.line = d.line;
        issues.push(issue);
        if (issues.length >= 500) break;
      }
      // ricalcola errori con tsc dentro
      summary.errors = issues.filter((i) => i.severity === "error").length;
    } catch {
      diagnosed = false; // mai nasconde lo stile se il dottore fallisce
    }
  }

  ctx.logger.info("review_code", { files, issues: issues.length, diagnosed });
  return { issues: issues.slice(0, 500), summary, truncated, diagnosed };
}
