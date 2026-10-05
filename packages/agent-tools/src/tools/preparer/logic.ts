import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface PreparerInput {
  goal: string;
  paths?: string[];
  includeGlobs?: string[];
  excludeGlobs?: string[];
  maxFiles?: number;
  maxBytesPerFile?: number;
}

export interface PreparerFile {
  path: string;
  abs: string;
  bytes: number;
  lines: number;
  score: number;
  snippet: string;
}

export interface PreparerPlanStep {
  kind: "create" | "edit";
  path: string;
  hint: string;
}

export interface PreparerOutput {
  goal: string;
  files: PreparerFile[];
  plan: { steps: PreparerPlanStep[] };
  truncated: boolean;
}

export const PREPARER_VERSION = "1.0.0";

const DEFAULT_EXCLUDE_DIRS = new Set(["node_modules", "dist", ".git", "coverage", ".tmp-demo"]);
const HARD_FILE_LIMIT = 2000;

function tokenize(goal: string): string[] {
  return goal
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((t) => t.length >= 3)
    .slice(0, 20);
}

/** Matcher glob minimale v1: supporta *, suffix/prefix/contains. */
function matchGlob(fileRel: string, pattern: string): boolean {
  const rel = fileRel.replace(/\\/g, "/");
  const pat = pattern.replace(/\\/g, "/");
  if (pat === "**" || pat === "*" || pat === "**/*") return true;
  if (!pat.includes("*")) return rel === pat || rel.endsWith("/" + pat);
  // escape regex tranne *
  const rx = new RegExp("^" + pat.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
  return rx.test(rel) || rx.test(path.basename(rel));
}

function excludedRel(relPosix: string, excludeGlobs: string[]): boolean {
  const parts = relPosix.split("/");
  if (parts.some((p) => DEFAULT_EXCLUDE_DIRS.has(p))) return true;
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

function scoreFile(relPosix: string, contentLower: string, tokens: string[]): number {
  let score = 0;
  const relLower = relPosix.toLowerCase();
  const base = path.basename(relLower);
  for (const t of tokens) {
    if (base.includes(t)) score += 5;
    else if (relLower.includes(t)) score += 2;
    // occorrenze nel contenuto (cap per token per non dominare)
    let idx = 0;
    let count = 0;
    while ((idx = contentLower.indexOf(t, idx)) !== -1 && count < 10) {
      count++;
      idx += t.length;
    }
    score += Math.min(count, 10);
  }
  return score;
}

export async function preparerLogic(ctx: ToolContext, input: PreparerInput): Promise<PreparerOutput> {
  const goal = (input.goal ?? "").trim();
  if (!goal) throw Object.assign(new Error("goal is required"), { code: "BAD_ARGS" });

  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["."];
  const maxFiles = input.maxFiles ?? 20;
  const maxBytes = input.maxBytesPerFile ?? 20000;
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 100) {
    throw Object.assign(new Error("maxFiles must be 1..100"), { code: "BAD_ARGS" });
  }
  if (!Number.isInteger(maxBytes) || maxBytes < 500 || maxBytes > 200000) {
    throw Object.assign(new Error("maxBytesPerFile must be 500..200000"), { code: "BAD_ARGS" });
  }
  const includeGlobs = input.includeGlobs ?? [];
  const excludeGlobs = input.excludeGlobs ?? [];
  const tokens = tokenize(goal);

  // Risolvi scope
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

  // Raccogli file
  let candidates: string[] = [];
  for (const t of absTargets) {
    if (!t.isDir) {
      candidates.push(t.abs);
    } else {
      await walk(t.abs, ctx.cwd, excludeGlobs, candidates);
    }
  }

  // Filtro include
  if (includeGlobs.length > 0) {
    candidates = candidates.filter((abs) => {
      const rel = path.relative(ctx.cwd, abs).replace(/\\/g, "/");
      return includeGlobs.some((g) => matchGlob(rel, g));
    });
  }

  const scored: PreparerFile[] = [];
  let scanned = 0;
  for (const abs of candidates) {
    scanned++;
    if (scanned > HARD_FILE_LIMIT) break;
    let st: Awaited<ReturnType<typeof fs.stat>>;
    try {
      st = await fs.stat(abs);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size > 500_000) continue; // skip enormi v1
    let content: string;
    try {
      content = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }
    if (content.includes("\0")) continue; // binario
    const rel = path.relative(ctx.cwd, abs).replace(/\\/g, "/");
    const lower = content.toLowerCase();
    const score = tokens.length === 0 ? 1 : scoreFile(rel, lower, tokens);
    if (tokens.length > 0 && score === 0) continue;
    const lines = content.split("\n").length;
    const snippetRaw = content.slice(0, maxBytes);
    const snippetLines = snippetRaw.split("\n").slice(0, 60).join("\n");
    scored.push({ path: rel, abs, bytes: st.size, lines, score, snippet: snippetLines });
  }

  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const truncated = scored.length > maxFiles;
  const top = scored.slice(0, maxFiles);

  const steps: PreparerPlanStep[] = top.slice(0, Math.min(5, top.length)).map((f) => ({
    kind: "edit",
    path: f.path,
    hint: `Relevant to "${goal.slice(0, 120)}" (score ${f.score}). Read snippet, then use edit_file or create_file.`,
  }));

  ctx.logger.info("prepare_context", { goal: goal.slice(0, 80), files: top.length, truncated });
  return { goal, files: top, plan: { steps }, truncated };
}
