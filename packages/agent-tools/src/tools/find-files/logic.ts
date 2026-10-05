import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface FindFilesInput {
  pattern: string;
  paths?: string[];
  maxFiles?: number;
  includeHidden?: boolean;
}

export interface FindFilesMatch {
  path: string;
  abs: string;
}

export interface FindFilesOutput {
  pattern: string;
  matches: FindFilesMatch[];
  truncated: boolean;
}

export const FIND_FILES_VERSION = "1.0.0";

const EXCLUDE = new Set(["node_modules", "dist", ".git", "coverage", ".agent"]);

function globToRegExp(glob: string): RegExp {
  const normalized = glob.replace(/\\/g, "/").trim();
  let rx = "";
  let i = 0;
  while (i < normalized.length) {
    const c = normalized[i]!;
    if (c === "*") {
      if (normalized[i + 1] === "*") {
        if (normalized[i + 2] === "/") {
          rx += "(?:.*/)?";
          i += 3;
        } else {
          rx += ".*";
          i += 2;
        }
      } else {
        rx += "[^/]*";
        i += 1;
      }
    } else if (c === "?") {
      rx += "[^/]";
      i += 1;
    } else if ("+()|^$.{}[]\\".includes(c)) {
      rx += `\\${c}`;
      i += 1;
    } else {
      rx += c;
      i += 1;
    }
  }
  return new RegExp(`^(?:.*/)?${rx}$`);
}

async function walk(absDir: string, cwd: string, out: string[], limit: number, includeHidden: boolean): Promise<void> {
  if (out.length >= limit) return;
  let entries;
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (out.length >= limit) return;
    if (!includeHidden && e.name.startsWith(".")) continue;
    const abs = path.join(absDir, e.name);
    const rel = path.relative(cwd, abs).replace(/\\/g, "/");
    if (rel.split("/").some((p) => EXCLUDE.has(p))) continue;
    if (e.isDirectory()) {
      await walk(abs, cwd, out, limit, includeHidden);
    } else if (e.isFile()) {
      out.push(abs);
    }
  }
}

export async function findFilesLogic(ctx: ToolContext, input: FindFilesInput): Promise<FindFilesOutput> {
  const pattern = (input.pattern ?? "").trim();
  if (!pattern) throw Object.assign(new Error("pattern is required"), { code: "BAD_ARGS" });
  if (path.isAbsolute(pattern) || pattern.includes("..")) {
    throw Object.assign(new Error("pattern must be relative without .."), { code: "BAD_ARGS" });
  }
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["."];
  const maxFiles = input.maxFiles ?? 50;
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 200) {
    throw Object.assign(new Error("maxFiles must be 1..200"), { code: "BAD_ARGS" });
  }
  const includeHidden = input.includeHidden ?? false;
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
  }

  const rx = globToRegExp(pattern);
  let candidates: string[] = [];
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) continue;
    const st = await fs.stat(r.abs).catch(() => undefined);
    if (!st) throw Object.assign(new Error(`path not found: ${p}`), { code: "NOT_FOUND" });
    if (st.isFile()) candidates.push(r.abs);
    else await walk(r.abs, ctx.cwd, candidates, 5000, includeHidden);
  }

  const matches: FindFilesMatch[] = [];
  for (const abs of candidates) {
    const rel = path.relative(ctx.cwd, abs).replace(/\\/g, "/");
    const base = path.basename(rel);
    if (rx.test(rel) || rx.test(base)) {
      matches.push({ path: rel, abs });
      if (matches.length > maxFiles) break;
    }
  }
  matches.sort((a, b) => a.path.localeCompare(b.path));
  const truncated = matches.length > maxFiles;
  const sliced = matches.slice(0, maxFiles);

  ctx.logger.info("find_files", { pattern: pattern.slice(0, 80), matches: sliced.length });
  return { pattern, matches: sliced, truncated };
}
