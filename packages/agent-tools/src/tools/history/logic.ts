import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export type HistoryAction = "record" | "list" | "restore" | "clear";

export interface HistoryInput {
  action?: HistoryAction;
  path?: string;
  versionId?: string;
  maxVersions?: number;
}

export interface HistoryVersion {
  versionId: string;
  path: string;
  time: string;
  bytes: number;
  hash: string;
}

export interface HistoryOutput {
  action: HistoryAction;
  versions: HistoryVersion[];
  restored?: string;
}

export const HISTORY_VERSION = "1.0.0";
const HISTORY_DIR = ".agent/history";

function hashPath(rel: string): string {
  return crypto.createHash("sha256").update(rel, "utf8").digest("hex").slice(0, 16);
}

function stamp(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${Math.random().toString(36).slice(2, 7)}`;
}

async function listVersions(cwd: string, rel: string): Promise<HistoryVersion[]> {
  const dir = path.join(cwd, HISTORY_DIR, hashPath(rel));
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  entries.sort().reverse();
  const out: HistoryVersion[] = [];
  for (const e of entries) {
    if (!e.endsWith(".meta.json")) continue;
    try {
      const meta = JSON.parse(await fs.readFile(path.join(dir, e), "utf8")) as HistoryVersion;
      out.push(meta);
    } catch {
      continue;
    }
  }
  return out;
}

export async function historyLogic(ctx: ToolContext, input: HistoryInput): Promise<HistoryOutput> {
  const action = input.action ?? "list";
  if (!["record", "list", "restore", "clear"].includes(action))
    throw Object.assign(new Error("unknown action"), { code: "BAD_ARGS" });
  const maxVersions = input.maxVersions ?? 20;
  if (!Number.isInteger(maxVersions) || maxVersions < 1 || maxVersions > 100) {
    throw Object.assign(new Error("maxVersions must be 1..100"), { code: "BAD_ARGS" });
  }

  if (action === "record") {
    const rel = (input.path ?? "").trim();
    if (!rel) throw Object.assign(new Error("path is required for record"), { code: "BAD_ARGS" });
    const r = resolveSafePath(ctx, rel);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${rel}`), { code: "PATH_TRAVERSAL" });
    let content: string;
    try {
      const st = await fs.stat(r.abs);
      if (!st.isFile()) throw Object.assign(new Error("not a file"), { code: "NOT_FILE" });
      if (st.size > 1_000_000) throw Object.assign(new Error("file too big"), { code: "TOO_BIG" });
      content = await fs.readFile(r.abs, "utf8");
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT")
        throw Object.assign(new Error("file not found"), { code: "NOT_FOUND" });
      throw e;
    }
    const versionId = stamp();
    const dir = path.join(ctx.cwd, HISTORY_DIR, hashPath(rel));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${versionId}.txt`), content, "utf8");
    const meta: HistoryVersion = {
      versionId,
      path: rel,
      time: new Date().toISOString(),
      bytes: Buffer.byteLength(content, "utf8"),
      hash: crypto.createHash("sha256").update(content, "utf8").digest("hex").slice(0, 16),
    };
    await fs.writeFile(path.join(dir, `${versionId}.meta.json`), JSON.stringify(meta), "utf8");
    const versions = await listVersions(ctx.cwd, rel);
    for (const v of versions.slice(maxVersions)) {
      await fs.rm(path.join(dir, `${v.versionId}.txt`), { force: true });
      await fs.rm(path.join(dir, `${v.versionId}.meta.json`), { force: true });
    }
    ctx.logger.info("history", { action, path: rel, versionId });
    return { action, versions: versions.slice(0, maxVersions) };
  }

  if (action === "list") {
    const rel = (input.path ?? "").trim();
    if (!rel) {
      const base = path.join(ctx.cwd, HISTORY_DIR);
      let dirs: string[];
      try {
        dirs = await fs.readdir(base);
      } catch {
        return { action, versions: [] };
      }
      const out: HistoryVersion[] = [];
      for (const d of dirs.slice(0, 50)) {
        try {
          const metas = await fs.readdir(path.join(base, d));
          for (const m of metas.filter((x) => x.endsWith(".meta.json")).slice(0, 3)) {
            const meta = JSON.parse(await fs.readFile(path.join(base, d, m), "utf8")) as HistoryVersion;
            out.push(meta);
          }
        } catch {
          continue;
        }
      }
      return { action, versions: out.slice(0, maxVersions) };
    }
    return { action, versions: (await listVersions(ctx.cwd, rel)).slice(0, maxVersions) };
  }

  if (action === "restore") {
    const rel = (input.path ?? "").trim();
    const versionId = (input.versionId ?? "").trim();
    if (!rel || !versionId)
      throw Object.assign(new Error("path and versionId required for restore"), { code: "BAD_ARGS" });
    if (!/^[0-9a-zA-Z-]+$/.test(versionId)) throw Object.assign(new Error("bad versionId"), { code: "BAD_ARGS" });
    const r = resolveSafePath(ctx, rel);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${rel}`), { code: "PATH_TRAVERSAL" });
    const dir = path.join(ctx.cwd, HISTORY_DIR, hashPath(rel));
    let content: string;
    try {
      content = await fs.readFile(path.join(dir, `${versionId}.txt`), "utf8");
    } catch {
      throw Object.assign(new Error("version not found"), { code: "NOT_FOUND" });
    }
    const tmp = `${r.abs}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, content, "utf8");
    await fs.rename(tmp, r.abs);
    ctx.logger.info("history", { action, path: rel, versionId });
    return { action, versions: await listVersions(ctx.cwd, rel), restored: rel };
  }

  // clear
  const rel = (input.path ?? "").trim();
  if (rel) {
    const dir = path.join(ctx.cwd, HISTORY_DIR, hashPath(rel));
    await fs.rm(dir, { recursive: true, force: true });
  } else {
    await fs.rm(path.join(ctx.cwd, HISTORY_DIR), { recursive: true, force: true });
  }
  return { action, versions: [] };
}
