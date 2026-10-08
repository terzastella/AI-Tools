import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface RenameInput {
  oldName: string;
  newName: string;
  paths?: string[];
  includeGlobs?: string[];
  dryRun?: boolean;
}

export interface RenameOutput {
  oldName: string;
  newName: string;
  files: { path: string; replacements: number }[];
  total: number;
  dryRun: boolean;
}

export const RENAME_VERSION = "1.0.0";
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const EXCLUDE = new Set(["node_modules", "dist", ".git", "coverage", ".agent"]);

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function walk(absDir: string, cwd: string, out: string[]): Promise<void> {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(absDir, e.name);
    const rel = path.relative(cwd, abs).replace(/\\/g, "/");
    if (rel.split("/").some((p) => EXCLUDE.has(p))) continue;
    if (e.isDirectory()) await walk(abs, cwd, out);
    else if (e.isFile() && /\.(ts|js|mjs|cjs|tsx|jsx|json|md)$/.test(e.name)) out.push(abs);
    if (out.length >= 500) return;
  }
}

export async function renameLogic(ctx: ToolContext, input: RenameInput): Promise<RenameOutput> {
  const oldName = (input.oldName ?? "").trim();
  const newName = (input.newName ?? "").trim();
  if (!IDENT_RE.test(oldName) || !IDENT_RE.test(newName)) {
    throw Object.assign(new Error("oldName/newName must be identifiers"), { code: "BAD_ARGS" });
  }
  if (oldName === newName) throw Object.assign(new Error("names are identical"), { code: "NOOP" });
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["."];
  const dryRun = input.dryRun ?? false;
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
    else await walk(r.abs, ctx.cwd, candidates);
  }

  const re = new RegExp(`\\b${esc(oldName)}\\b`, "g");
  const files: RenameOutput["files"] = [];
  for (const abs of candidates) {
    let content: string;
    try {
      content = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }
    if (content.includes("\0")) continue;
    const count = (content.match(re) ?? []).length;
    if (count === 0) continue;
    const rel = path.relative(ctx.cwd, abs).replace(/\\/g, "/");
    if (!dryRun) {
      const next = content.replace(re, newName);
      const tmp = `${abs}.tmp-${process.pid}-${Date.now()}`;
      await fs.writeFile(tmp, next, "utf8");
      await fs.rename(tmp, abs);
    }
    files.push({ path: rel, replacements: count });
  }

  const total = files.reduce((a, f) => a + f.replacements, 0);
  ctx.logger.info("rename_symbol", { oldName, newName, files: files.length, total, dryRun });
  return { oldName, newName, files, total, dryRun };
}
