import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface MemoryStoreInput {
  op: "put" | "get" | "search" | "clear";
  text?: string;
  id?: string;
  query?: string;
  scope?: "session" | "project";
  maxResults?: number;
}

export interface MemoryEntry {
  id: string;
  text: string;
  scope: string;
  time: string;
}

export interface MemoryStoreOutput {
  op: string;
  entry?: MemoryEntry;
  entries?: MemoryEntry[];
  cleared?: number;
}

export const MEMORY_STORE_VERSION = "1.0.0";

const DIR = ".agent/memory";

function score(text: string, query: string): number {
  const t = text.toLowerCase();
  let s = 0;
  for (const w of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    if (t.includes(w)) s += w.length > 4 ? 2 : 1;
  }
  return s;
}

async function fileFor(ctx: ToolContext, scope: string): Promise<string> {
  const dir = path.resolve(ctx.cwd, DIR);
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, scope === "project" ? "project.jsonl" : "session.jsonl");
}

async function readAll(file: string): Promise<MemoryEntry[]> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return [];
  }
  const out: MemoryEntry[] = [];
  for (const line of raw.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      const e = JSON.parse(s) as MemoryEntry;
      if (e.id && e.text) out.push(e);
    } catch {
      /* riga rotta, salta */
    }
  }
  return out;
}

export async function memoryStoreLogic(ctx: ToolContext, input: MemoryStoreInput): Promise<MemoryStoreOutput> {
  const op = input.op ?? "";
  const scope = input.scope ?? "session";
  if (scope !== "session" && scope !== "project") throw Object.assign(new Error("scope must be session|project"), { code: "BAD_ARGS" });
  const file = await fileFor(ctx, scope);
  // sicurezza: il file deve restare dentro cwd
  const r = resolveSafePath(ctx, path.relative(ctx.cwd, file).replace(/\\/g, "/"));
  if (!r.ok) throw Object.assign(new Error("memory escapes cwd"), { code: "PATH_TRAVERSAL" });

  if (op === "put") {
    const text = (input.text ?? "").trim();
    if (!text || text.length > 5000) throw Object.assign(new Error("text 1..5000 chars required"), { code: "BAD_ARGS" });
    const entry: MemoryEntry = { id: `m-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`, text, scope, time: new Date().toISOString() };
    await fs.appendFile(file, JSON.stringify(entry) + "\n", "utf8");
    ctx.logger.info("memory_store put", { scope });
    return { op, entry };
  }
  if (op === "get") {
    const all = await readAll(file);
    const e = all.find((x) => x.id === input.id);
    if (!e) throw Object.assign(new Error(`memory not found: ${input.id}`), { code: "NOT_FOUND" });
    return { op, entry: e };
  }
  if (op === "search") {
    const q = (input.query ?? "").trim();
    if (!q) throw Object.assign(new Error("query required"), { code: "BAD_ARGS" });
    const max = input.maxResults ?? 5;
    if (!Number.isInteger(max) || max < 1 || max > 20) throw Object.assign(new Error("maxResults must be 1..20"), { code: "BAD_ARGS" });
    const all = await readAll(file);
    const ranked = all
      .map((e) => ({ e, s: score(e.text, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, max)
      .map((x) => x.e);
    return { op, entries: ranked };
  }
  if (op === "clear") {
    const all = await readAll(file);
    await fs.writeFile(file, "", "utf8");
    return { op, cleared: all.length };
  }
  throw Object.assign(new Error(`unknown op: ${op} (put|get|search|clear)`), { code: "BAD_ARGS" });
}
