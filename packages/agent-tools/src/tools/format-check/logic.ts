import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export type FormatRule = "trailing-space" | "tab-indent" | "mixed-eol" | "missing-eof-newline" | "double-blank";

export interface FormatCheckInput {
  paths?: string[];
  maxFiles?: number;
  rules?: FormatRule[];
}

export interface FormatIssue {
  path: string;
  line: number;
  rule: FormatRule;
  message: string;
}

export interface FormatCheckOutput {
  issues: FormatIssue[];
  summary: { files: number; issues: number };
  truncated: boolean;
}

export const FORMAT_CHECK_VERSION = "1.0.0";

export const ALL_FORMAT_RULES: FormatRule[] = [
  "trailing-space",
  "tab-indent",
  "mixed-eol",
  "missing-eof-newline",
  "double-blank",
];

const EXCLUDE = new Set(["node_modules", "dist", ".git", "coverage", ".agent"]);

async function walk(absDir: string, cwd: string, out: string[], limit: number): Promise<void> {
  if (out.length >= limit) return;
  let entries;
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (out.length >= limit) return;
    const abs = path.join(absDir, e.name);
    const rel = path.relative(cwd, abs).replace(/\\/g, "/");
    if (rel.split("/").some((p) => EXCLUDE.has(p))) continue;
    if (e.isDirectory()) await walk(abs, cwd, out, limit);
    else if (e.isFile()) out.push(abs);
  }
}

export async function formatCheckLogic(ctx: ToolContext, input: FormatCheckInput): Promise<FormatCheckOutput> {
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["."];
  const maxFiles = input.maxFiles ?? 20;
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 100) {
    throw Object.assign(new Error("maxFiles must be 1..100"), { code: "BAD_ARGS" });
  }
  const rules = input.rules && input.rules.length > 0 ? input.rules : ALL_FORMAT_RULES;
  for (const r of rules) {
    if (!ALL_FORMAT_RULES.includes(r)) throw Object.assign(new Error(`unknown rule: ${r}`), { code: "BAD_ARGS" });
  }
  const ruleSet = new Set(rules);
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
  }

  const candidates: string[] = [];
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) continue;
    const st = await fs.stat(r.abs).catch(() => undefined);
    if (!st) throw Object.assign(new Error(`path not found: ${p}`), { code: "NOT_FOUND" });
    if (st.isFile()) candidates.push(r.abs);
    else await walk(r.abs, ctx.cwd, candidates, 1000);
  }

  const truncated = candidates.length > maxFiles;
  const issues: FormatIssue[] = [];
  let files = 0;
  for (const abs of candidates.slice(0, maxFiles)) {
    let st;
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
    if (
      ruleSet.has("mixed-eol") &&
      content.includes("\r\n") &&
      content.includes("\n") &&
      content.replace(/\r\n/g, "").includes("\n")
    ) {
      issues.push({ path: rel, line: 1, rule: "mixed-eol", message: "Mixed CRLF and LF line endings." });
    }
    const lines = content.split("\n");
    let prevBlank = false;
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i]!;
      const lineNo = i + 1;
      const isLast = i === lines.length - 1;
      if (ruleSet.has("trailing-space") && !isLast && /[ \t]+$/.test(ln)) {
        issues.push({ path: rel, line: lineNo, rule: "trailing-space", message: "Trailing whitespace." });
      }
      if (ruleSet.has("tab-indent") && /^\t+/.test(ln)) {
        issues.push({ path: rel, line: lineNo, rule: "tab-indent", message: "Tab indentation." });
      }
      const blank = ln.trim() === "";
      if (ruleSet.has("double-blank") && blank && prevBlank && !isLast) {
        issues.push({ path: rel, line: lineNo, rule: "double-blank", message: "Consecutive blank lines." });
      }
      prevBlank = blank;
      if (issues.length >= 300) break;
    }
    if (ruleSet.has("missing-eof-newline") && content.length > 0 && !content.endsWith("\n")) {
      issues.push({
        path: rel,
        line: lines.length,
        rule: "missing-eof-newline",
        message: "Missing newline at end of file.",
      });
    }
    if (issues.length >= 300) break;
  }

  ctx.logger.info("format_check", { files, issues: issues.length });
  return { issues: issues.slice(0, 300), summary: { files, issues: Math.min(issues.length, 300) }, truncated };
}
