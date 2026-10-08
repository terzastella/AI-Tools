import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface SearchTextInput {
  pattern: string;
  paths?: string[];
  include?: string;
  maxMatches?: number;
  contextLines?: number;
}

export interface SearchTextMatch {
  path: string;
  abs: string;
  line: number;
  col: number;
  snippet: string;
}

export interface SearchTextOutput {
  pattern: string;
  matches: SearchTextMatch[];
  files: number;
  truncated: boolean;
}

export const SEARCH_TEXT_VERSION = "1.0.0";

const EXCLUDE = new Set(["node_modules", "dist", ".git", "coverage", ".agent"]);
const MAX_FILE_BYTES = 400_000;

function globToRegExp(glob: string): RegExp {
  const n = glob.replace(/\\/g, "/");
  let rx = "";
  let i = 0;
  while (i < n.length) {
    const c = n[i]!;
    if (c === "*") {
      if (n[i + 1] === "*") {
        rx += ".*";
        i += 2;
      } else {
        rx += "[^/]*";
        i += 1;
      }
    } else if ("+()|^$.{}[]\\".includes(c)) {
      rx += `\\${c}`;
      i += 1;
    } else {
      rx += c;
      i += 1;
    }
  }
  return new RegExp(`^${rx}$`);
}

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

export async function searchTextLogic(ctx: ToolContext, input: SearchTextInput): Promise<SearchTextOutput> {
  const pattern = (input.pattern ?? "").trim();
  if (!pattern) throw Object.assign(new Error("pattern is required"), { code: "BAD_ARGS" });
  let re: RegExp;
  try {
    re = new RegExp(pattern, "g");
  } catch {
    throw Object.assign(new Error(`invalid regex: ${pattern}`), { code: "BAD_PATTERN" });
  }
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["."];
  const maxMatches = input.maxMatches ?? 50;
  if (!Number.isInteger(maxMatches) || maxMatches < 1 || maxMatches > 200) {
    throw Object.assign(new Error("maxMatches must be 1..200"), { code: "BAD_ARGS" });
  }
  const contextLines = input.contextLines ?? 0;
  if (!Number.isInteger(contextLines) || contextLines < 0 || contextLines > 3) {
    throw Object.assign(new Error("contextLines must be 0..3"), { code: "BAD_ARGS" });
  }
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
  }
  const includeRe = input.include ? globToRegExp(input.include) : undefined;

  const candidates: string[] = [];
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) continue;
    const st = await fs.stat(r.abs).catch(() => undefined);
    if (!st) throw Object.assign(new Error(`path not found: ${p}`), { code: "NOT_FOUND" });
    if (st.isFile()) candidates.push(r.abs);
    else await walk(r.abs, ctx.cwd, candidates, 1500);
  }

  const matches: SearchTextMatch[] = [];
  const files = new Set<string>();
  for (const abs of candidates) {
    if (matches.length >= maxMatches) break;
    const rel = path.relative(ctx.cwd, abs).replace(/\\/g, "/");
    if (includeRe && !includeRe.test(path.basename(rel)) && !includeRe.test(rel)) continue;
    let st;
    try {
      st = await fs.stat(abs);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
    let content: string;
    try {
      content = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }
    if (content.includes("\0")) continue;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
      const lineText = lines[i]!;
      re.lastIndex = 0;
      const m = re.exec(lineText);
      if (m) {
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length - 1, i + contextLines);
        const snippet = lines
          .slice(start, end + 1)
          .join(" ")
          .slice(0, 200);
        matches.push({ path: rel, abs, line: i + 1, col: (m.index ?? 0) + 1, snippet });
        files.add(rel);
      }
    }
  }

  ctx.logger.info("search_text", { pattern: pattern.slice(0, 60), matches: matches.length });
  return { pattern, matches, files: files.size, truncated: matches.length >= maxMatches };
}
