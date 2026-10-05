import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface ListInput {
  path?: string;
  recursive?: boolean;
  maxEntries?: number;
  includeHidden?: boolean;
}

export interface ListEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
}

export interface ListOutput {
  path: string;
  abs: string;
  entries: ListEntry[];
  truncated: boolean;
}

export const LIST_VERSION = "1.0.0";

async function walk(absDir: string, cwd: string, relBase: string, out: ListEntry[], max: number, includeHidden: boolean): Promise<boolean> {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  entries.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
  for (const e of entries) {
    if (out.length >= max) return true;
    if (!includeHidden && e.name.startsWith(".")) continue;
    const abs = path.join(absDir, e.name);
    const rel = path.relative(cwd, abs).replace(/\\/g, "/");
    if (e.isDirectory()) {
      out.push({ name: e.name, path: rel, type: "dir" });
      const truncated = await walk(abs, cwd, rel, out, max, includeHidden);
      if (truncated) return true;
    } else if (e.isFile()) {
      let size: number | undefined;
      try {
        const st = await fs.stat(abs);
        size = st.size;
      } catch {
        size = undefined;
      }
      const entry: ListEntry = { name: e.name, path: rel, type: "file" };
      if (size !== undefined) entry.size = size;
      out.push(entry);
    }
  }
  return false;
}

export async function listLogic(ctx: ToolContext, input: ListInput): Promise<ListOutput> {
  const rel = (input.path ?? ".").trim() || ".";
  const recursive = input.recursive ?? false;
  const maxEntries = input.maxEntries ?? 100;
  const includeHidden = input.includeHidden ?? false;
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 1000) {
    throw Object.assign(new Error("maxEntries must be 1..1000"), { code: "BAD_ARGS" });
  }

  const r = resolveSafePath(ctx, rel);
  if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${rel}`), { code: "PATH_TRAVERSAL" });

  let st: Awaited<ReturnType<typeof fs.stat>>;
  try {
    st = await fs.stat(r.abs);
  } catch {
    throw Object.assign(new Error(`path not found: ${rel}`), { code: "NOT_FOUND" });
  }
  if (!st.isDirectory()) throw Object.assign(new Error(`not a directory: ${rel}`), { code: "NOT_DIR" });

  const entries: ListEntry[] = [];
  let truncated = false;
  if (!recursive) {
    const dirents = await fs.readdir(r.abs, { withFileTypes: true });
    dirents.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
    for (const e of dirents) {
      if (entries.length >= maxEntries) {
        truncated = true;
        break;
      }
      if (!includeHidden && e.name.startsWith(".")) continue;
      const abs = path.join(r.abs, e.name);
      const relPath = path.relative(ctx.cwd, abs).replace(/\\/g, "/");
      if (e.isDirectory()) {
        entries.push({ name: e.name, path: relPath, type: "dir" });
      } else if (e.isFile()) {
        let size: number | undefined;
        try {
          size = (await fs.stat(abs)).size;
        } catch {
          size = undefined;
        }
        const entry: ListEntry = { name: e.name, path: relPath, type: "file" };
        if (size !== undefined) entry.size = size;
        entries.push(entry);
      }
    }
  } else {
    truncated = await walk(r.abs, ctx.cwd, rel, entries, maxEntries, includeHidden);
  }

  ctx.logger.info("list_directory", { path: rel, entries: entries.length, truncated });
  return { path: rel, abs: r.abs, entries: entries.slice(0, maxEntries), truncated };
}
