import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface RefsInput {
  symbol: string;
  paths?: string[];
  maxFiles?: number;
  maxMatches?: number;
}

export interface RefsMatch {
  path: string;
  line: number;
  col: number;
  snippet: string;
}

export interface RefsOutput {
  symbol: string;
  matches: RefsMatch[];
  files: number;
  truncated: boolean;
}

export const REFS_VERSION = "1.0.0";
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
    else if (e.isFile() && /\.(ts|js|mjs|cjs|tsx|jsx|json)$/.test(e.name)) out.push(abs);
    if (out.length >= 800) return;
  }
}

export async function refsLogic(ctx: ToolContext, input: RefsInput): Promise<RefsOutput> {
  const symbol = (input.symbol ?? "").trim();
  if (!IDENT_RE.test(symbol)) throw Object.assign(new Error("symbol must be an identifier"), { code: "BAD_ARGS" });
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["."];
  const maxFiles = input.maxFiles ?? 20;
  const maxMatches = input.maxMatches ?? 50;
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

  const re = new RegExp(`\\b${esc(symbol)}\\b`, "g");
  const matches: RefsMatch[] = [];
  const files = new Set<string>();
  for (const abs of candidates.slice(0, maxFiles * 10)) {
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
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      // salta la riga di definizione export per non sporcare (la trova goto)
      if (
        /^export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+/.test(line.trim()) &&
        line.includes(symbol)
      )
        continue;
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(line)) !== null) {
        matches.push({ path: rel, line: i + 1, col: m.index + 1, snippet: line.slice(0, 200) });
        files.add(rel);
        if (matches.length >= maxMatches) break;
      }
      if (matches.length >= maxMatches) break;
    }
    if (matches.length >= maxMatches) break;
  }

  const truncated = matches.length >= maxMatches;
  ctx.logger.info("find_references", { symbol, matches: matches.length });
  return { symbol, matches: matches.slice(0, maxMatches), files: files.size, truncated };
}
