import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface ImportMapInput {
  paths?: string[];
  maxFiles?: number;
}

export interface ImportNode {
  path: string;
  imports: string[];
}

export interface ImportMapOutput {
  nodes: ImportNode[];
  files: number;
  truncated: boolean;
}

export const IMPORT_MAP_VERSION = "1.0.0";

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
    else if (e.isFile() && /\.(ts|js|mjs|cjs|tsx|jsx)$/.test(e.name)) out.push(abs);
  }
}

export async function importMapLogic(ctx: ToolContext, input: ImportMapInput): Promise<ImportMapOutput> {
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["src"];
  const maxFiles = input.maxFiles ?? 100;
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 500) {
    throw Object.assign(new Error("maxFiles must be 1..500"), { code: "BAD_ARGS" });
  }
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
  }

  let candidates: string[] = [];
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) continue;
    const st = await fs.stat(r.abs).catch(() => undefined);
    if (!st) continue;
    if (st.isFile()) candidates.push(r.abs);
    else await walk(r.abs, ctx.cwd, candidates, 1000);
  }

  const nodes: ImportNode[] = [];
  for (const abs of candidates.slice(0, maxFiles)) {
    let content: string;
    try {
      const st = await fs.stat(abs);
      if (st.size > 400_000) continue;
      const full = await fs.readFile(abs, "utf8");
      if (full.includes("\0")) continue;
      content = full.split("\n").slice(0, 50).join("\n");
    } catch {
      continue;
    }
    const rel = path.relative(ctx.cwd, abs).replace(/\\/g, "/");
    const imports: string[] = [];
    const re = /import\s+(?:[^'"]*from\s*)?['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const spec = m[1]!;
      if (spec.startsWith(".")) {
        imports.push(path.normalize(path.join(path.dirname(rel), spec)).replace(/\\/g, "/"));
      } else {
        imports.push(spec.slice(0, 120));
      }
    }
    nodes.push({ path: rel, imports: imports.slice(0, 20) });
  }
  nodes.sort((a, b) => a.path.localeCompare(b.path));
  return { nodes, files: nodes.length, truncated: candidates.length > maxFiles };
}
