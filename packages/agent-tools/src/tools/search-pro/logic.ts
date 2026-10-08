import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface SearchProInput {
  query: string;
  paths?: string[];
  maxFiles?: number;
  maxSnippets?: number;
}

export interface SearchHit {
  path: string;
  abs: string;
  score: number;
  snippets: string[];
}

export interface SearchProOutput {
  query: string;
  hits: SearchHit[];
  truncated: boolean;
}

export const SEARCH_PRO_VERSION = "1.0.0";

const EXCLUDE = new Set(["node_modules", "dist", ".git", "coverage", ".agent"]);

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((t) => t.length >= 2)
    .slice(0, 15);
}

async function walk(absDir: string, cwd: string, out: string[], limit: number): Promise<void> {
  if (out.length >= limit) return;
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  for (const e of entries) {
    if (out.length >= limit) return;
    const abs = path.join(absDir, e.name);
    const rel = path.relative(cwd, abs).replace(/\\/g, "/");
    if (rel.split("/").some((p) => EXCLUDE.has(p))) continue;
    if (e.isDirectory()) await walk(abs, cwd, out, limit);
    else if (e.isFile() && /\.(ts|js|mjs|cjs|tsx|jsx|json|md)$/.test(e.name)) out.push(abs);
  }
}

export async function searchProLogic(ctx: ToolContext, input: SearchProInput): Promise<SearchProOutput> {
  const query = (input.query ?? "").trim();
  if (!query) throw Object.assign(new Error("query is required"), { code: "BAD_ARGS" });
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["."];
  const maxFiles = input.maxFiles ?? 15;
  const maxSnippets = input.maxSnippets ?? 3;
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
  }
  const tokens = tokenize(query);
  const candidates: string[] = [];
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) continue;
    const st = await fs.stat(r.abs).catch(() => undefined);
    if (!st) throw Object.assign(new Error(`path not found: ${p}`), { code: "NOT_FOUND" });
    if (st.isFile()) candidates.push(r.abs);
    else await walk(r.abs, ctx.cwd, candidates, 1500);
  }

  const hits: SearchHit[] = [];
  for (const abs of candidates) {
    let content: string;
    try {
      const st = await fs.stat(abs);
      if (!st.isFile() || st.size > 400_000) continue;
      content = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }
    if (content.includes("\0")) continue;
    const rel = path.relative(ctx.cwd, abs).replace(/\\/g, "/");
    const lower = content.toLowerCase();
    const base = path.basename(rel).toLowerCase();
    let score = 0;
    const snippets: string[] = [];
    for (const t of tokens) {
      if (base.includes(t)) score += 8;
      else if (rel.toLowerCase().includes(t)) score += 3;
      let idx = 0;
      let count = 0;
      while ((idx = lower.indexOf(t, idx)) !== -1 && count < 5) {
        count++;
        if (snippets.length < maxSnippets) {
          const start = Math.max(0, idx - 60);
          snippets.push(
            "…" +
              content
                .slice(start, idx + 120)
                .replace(/\n/g, " ")
                .slice(0, 180) +
              "…",
          );
        }
        idx += t.length;
      }
      score += Math.min(count, 5);
    }
    if (score > 0) hits.push({ path: rel, abs, score, snippets: snippets.slice(0, maxSnippets) });
  }

  hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const truncated = hits.length > maxFiles;
  ctx.logger.info("search_pro", { query: query.slice(0, 60), hits: Math.min(hits.length, maxFiles) });
  return { query, hits: hits.slice(0, maxFiles), truncated };
}
