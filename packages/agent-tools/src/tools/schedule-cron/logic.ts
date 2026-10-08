import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface ScheduleCronInput {
  op: "add" | "list" | "remove" | "due";
  task?: string;
  cron?: string;
  id?: string;
  now?: string;
}

export interface CronItem {
  id: string;
  task: string;
  cron: string;
  createdAt: string;
  lastRunAt: string | null;
}

export interface ScheduleCronOutput {
  op: string;
  item?: CronItem;
  items?: CronItem[];
  removed?: boolean;
}

export const SCHEDULE_CRON_VERSION = "1.0.0";

const FIELD_RE = /^(\*|\*\/\d+|\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)$/;

function parseField(raw: string, min: number, max: number): Set<number> | null {
  if (!FIELD_RE.test(raw)) return null;
  const out = new Set<number>();
  const add = (from: number, to: number, step: number): void => {
    for (let v = from; v <= to; v += step) {
      if (v >= min && v <= max) out.add(v);
    }
  };
  for (const part of raw.split(",")) {
    if (part === "*") {
      add(min, max, 1);
    } else if (part.startsWith("*/")) {
      add(min, max, Number(part.slice(2)));
    } else if (part.includes("-")) {
      const [a, b] = part.split("-").map(Number);
      if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
      add(a!, b!, 1);
    } else {
      const v = Number(part);
      if (!Number.isInteger(v)) return null;
      add(v, v, 1);
    }
  }
  return out;
}

export function validCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const ranges: [number, number][] = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 7],
  ];
  return parts.every((p, i) => parseField(p, ranges[i]![0], ranges[i]![1]) !== null);
}

export function cronDue(cron: string, at: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const sets = [
    parseField(parts[0]!, 0, 59),
    parseField(parts[1]!, 0, 23),
    parseField(parts[2]!, 1, 31),
    parseField(parts[3]!, 1, 12),
    parseField(parts[4]!, 0, 7),
  ];
  if (sets.some((s) => s === null)) return false;
  const vals = [at.getMinutes(), at.getHours(), at.getDate(), at.getMonth() + 1, at.getDay()];
  return sets.every((s, i) => {
    const set = s!;
    // domenica sia 0 che 7
    if (i === 4 && set.has(7) && vals[i] === 0) return true;
    return set.has(vals[i]!);
  });
}

async function loadFile(ctx: ToolContext): Promise<{ file: string; items: CronItem[] }> {
  const dir = path.resolve(ctx.cwd, ".agent/schedule");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "cron.jsonl");
  const rel = path.relative(ctx.cwd, file).replace(/\\/g, "/");
  const r = resolveSafePath(ctx, rel);
  if (!r.ok) throw Object.assign(new Error("schedule escapes cwd"), { code: "PATH_TRAVERSAL" });
  let raw = "";
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return { file, items: [] };
  }
  const items: CronItem[] = [];
  for (const line of raw.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      const e = JSON.parse(s) as CronItem;
      if (e.id && e.task && e.cron) items.push(e);
    } catch {
      /* salta */
    }
  }
  return { file, items };
}

async function saveFile(file: string, items: CronItem[]): Promise<void> {
  await fs.writeFile(file, items.map((e) => JSON.stringify(e)).join("\n") + (items.length > 0 ? "\n" : ""), "utf8");
}

export async function scheduleCronLogic(ctx: ToolContext, input: ScheduleCronInput): Promise<ScheduleCronOutput> {
  const op = input.op ?? "";
  const { file, items } = await loadFile(ctx);

  if (op === "add") {
    const task = (input.task ?? "").trim();
    const cron = (input.cron ?? "").trim();
    if (!task || task.length > 1000)
      throw Object.assign(new Error("task 1..1000 chars required"), { code: "BAD_ARGS" });
    if (!validCron(cron))
      throw Object.assign(new Error("cron deve avere 5 campi validi (min hour dom month dow)"), { code: "BAD_ARGS" });
    const item: CronItem = {
      id: `c-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
      task,
      cron,
      createdAt: new Date().toISOString(),
      lastRunAt: null,
    };
    items.push(item);
    await saveFile(file, items);
    ctx.logger.info("schedule_cron add", { cron });
    return { op, item };
  }
  if (op === "list") {
    return { op, items };
  }
  if (op === "remove") {
    const before = items.length;
    const rest = items.filter((e) => e.id !== input.id);
    if (rest.length === before)
      throw Object.assign(new Error(`schedule not found: ${input.id}`), { code: "NOT_FOUND" });
    await saveFile(file, rest);
    return { op, removed: true };
  }
  if (op === "due") {
    const at = input.now ? new Date(input.now) : new Date();
    if (Number.isNaN(at.getTime())) throw Object.assign(new Error("bad now date"), { code: "BAD_ARGS" });
    const due = items.filter((e) => {
      if (!cronDue(e.cron, at)) return false;
      if (!e.lastRunAt) return true;
      // non riproporre nello stesso minuto
      return new Date(e.lastRunAt).getTime() < at.getTime() - 60_000;
    });
    for (const d of due) d.lastRunAt = at.toISOString();
    if (due.length > 0) await saveFile(file, items);
    return { op, items: due };
  }
  throw Object.assign(new Error(`unknown op: ${op} (add|list|remove|due)`), { code: "BAD_ARGS" });
}
