import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface GotoInput {
  symbol: string;
  fromFile?: string;
  paths?: string[];
  maxResults?: number;
}

export interface GotoLocation {
  path: string;
  abs: string;
  line: number;
  col: number;
  snippet: string;
  kind: string;
}

export interface GotoOutput {
  symbol: string;
  locations: GotoLocation[];
}

export const GOTO_VERSION = "1.0.0";
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
    else if (e.isFile() && /\.(ts|js|mjs|cjs|tsx|jsx)$/.test(e.name)) out.push(abs);
    if (out.length >= 800) return;
  }
}

const PATTERNS: { kind: string; re: (sym: string) => RegExp }[] = [
  { kind: "export-function", re: (s) => new RegExp(`^export\\s+(?:async\\s+)?function\\s+${esc(s)}\\b`) },
  { kind: "export-const", re: (s) => new RegExp(`^export\\s+(?:const|let|var)\\s+${esc(s)}\\b`) },
  { kind: "export-class", re: (s) => new RegExp(`^export\\s+(?:abstract\\s+)?class\\s+${esc(s)}\\b`) },
  { kind: "export-interface", re: (s) => new RegExp(`^export\\s+(?:interface|type|enum)\\s+${esc(s)}\\b`) },
  { kind: "function", re: (s) => new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${esc(s)}\\b`) },
  { kind: "const-arrow", re: (s) => new RegExp(`^(?:export\\s+)?(?:const|let|var)\\s+${esc(s)}\\s*=`) },
  { kind: "class", re: (s) => new RegExp(`^(?:export\\s+)?(?:abstract\\s+)?class\\s+${esc(s)}\\b`) },
];

export async function gotoLogic(ctx: ToolContext, input: GotoInput): Promise<GotoOutput> {
  const symbol = (input.symbol ?? "").trim();
  if (!IDENT_RE.test(symbol)) throw Object.assign(new Error("symbol must be an identifier"), { code: "BAD_ARGS" });
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["."];
  const maxResults = input.maxResults ?? 5;
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
  }
  let fromImports: string[] = [];
  if (input.fromFile) {
    const r = resolveSafePath(ctx, input.fromFile);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${input.fromFile}`), { code: "PATH_TRAVERSAL" });
    try {
      const content = await fs.readFile(r.abs, "utf8");
      // import { symbol } from "./x" o import symbol from
      const importRe = new RegExp(`import\\s+(?:[^'"]*\\b${esc(symbol)}\\b[^'"]*from\\s*['"]([^'"]+)['"]|['"]([^'"]+)['"])`, "g");
      let m: RegExpExecArray | null;
      while ((m = importRe.exec(content)) !== null) {
        const spec = m[1] ?? m[2] ?? "";
        if (spec.startsWith(".")) {
          const resolved = path.normalize(path.join(path.dirname(input.fromFile), spec)).replace(/\\/g, "/");
          fromImports.push(resolved);
        }
      }
    } catch {
      /* fromFile opzionale */
    }
  }

  let candidates: string[] = [];
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) continue;
    const st = await fs.stat(r.abs).catch(() => undefined);
    if (!st) throw Object.assign(new Error(`path not found: ${p}`), { code: "NOT_FOUND" });
    if (st.isFile()) candidates.push(r.abs);
    else await walk(r.abs, ctx.cwd, candidates);
  }

  const locations: GotoLocation[] = [];
  for (const abs of candidates) {
    let content: string;
    try {
      content = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }
    if (content.includes("\0")) continue;
    const rel = path.relative(ctx.cwd, abs).replace(/\\/g, "/");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();
      for (const p of PATTERNS) {
        if (p.re(symbol).test(trimmed)) {
          const col = (lines[i]!.indexOf(symbol) ?? 0) + 1;
          locations.push({ path: rel, abs, line: i + 1, col, snippet: lines[i]!.slice(0, 200), kind: p.kind });
          break;
        }
      }
      if (locations.length >= maxResults * 3) break;
    }
  }

  // Ordina: import diretto prima, poi export, poi resto
  locations.sort((a, b) => {
    const aImp = fromImports.some((imp) => a.path.replace(/\.(ts|js)x?$/, "").endsWith(imp.replace(/\.(ts|js)x?$/, ""))) ? 0 : 1;
    const bImp = fromImports.some((imp) => b.path.replace(/\.(ts|js)x?$/, "").endsWith(imp.replace(/\.(ts|js)x?$/, ""))) ? 0 : 1;
    if (aImp !== bImp) return aImp - bImp;
    const aExp = a.kind.startsWith("export") ? 0 : 1;
    const bExp = b.kind.startsWith("export") ? 0 : 1;
    if (aExp !== bExp) return aExp - bExp;
    return a.path.localeCompare(b.path);
  });

  ctx.logger.info("go_to_definition", { symbol, found: locations.length });
  return { symbol, locations: locations.slice(0, maxResults) };
}
