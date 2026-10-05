import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export type MoveOp = "move" | "copy" | "delete";

export interface MoveInput {
  op: MoveOp;
  from: string;
  to?: string;
  overwrite?: boolean;
  mkdirs?: boolean;
}

export interface MoveOutput {
  op: MoveOp;
  from: string;
  to?: string;
  bytes?: number;
  dryRun: false;
}

export const MOVE_VERSION = "1.0.0";

async function copyRecursive(srcAbs: string, dstAbs: string): Promise<number> {
  const st = await fs.stat(srcAbs);
  if (st.isDirectory()) {
    await fs.mkdir(dstAbs, { recursive: true });
    const entries = await fs.readdir(srcAbs);
    let total = 0;
    for (const e of entries) total += await copyRecursive(path.join(srcAbs, e), path.join(dstAbs, e));
    return total;
  }
  await fs.mkdir(path.dirname(dstAbs), { recursive: true });
  await fs.copyFile(srcAbs, dstAbs);
  return st.size;
}

export async function moveLogic(ctx: ToolContext, input: MoveInput): Promise<MoveOutput> {
  const op = input.op ?? "move";
  const from = (input.from ?? "").trim();
  if (!from) throw Object.assign(new Error("from is required"), { code: "BAD_ARGS" });
  const overwrite = input.overwrite ?? false;
  const mkdirs = input.mkdirs ?? true;

  const rFrom = resolveSafePath(ctx, from);
  if (!rFrom.ok) throw Object.assign(new Error(`path escapes cwd: ${from}`), { code: "PATH_TRAVERSAL" });
  let stFrom: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stFrom = await fs.stat(rFrom.abs);
  } catch {
    throw Object.assign(new Error(`not found: ${from}`), { code: "NOT_FOUND" });
  }

  if (op === "delete") {
    await fs.rm(rFrom.abs, { recursive: true, force: true });
    ctx.logger.info("move_file", { op, from });
    return { op, from, dryRun: false };
  }

  const to = (input.to ?? "").trim();
  if (!to) throw Object.assign(new Error("to is required for move/copy"), { code: "BAD_ARGS" });
  if (from === to) throw Object.assign(new Error("from and to are identical"), { code: "NOOP" });
  const rTo = resolveSafePath(ctx, to);
  if (!rTo.ok) throw Object.assign(new Error(`path escapes cwd: ${to}`), { code: "PATH_TRAVERSAL" });

  let existsTo = false;
  try {
    await fs.stat(rTo.abs);
    existsTo = true;
  } catch {
    existsTo = false;
  }
  if (existsTo && !overwrite) throw Object.assign(new Error(`target exists: ${to}`), { code: "EXISTS" });

  if (mkdirs) await fs.mkdir(path.dirname(rTo.abs), { recursive: true });

  if (op === "copy") {
    const bytes = await copyRecursive(rFrom.abs, rTo.abs);
    ctx.logger.info("move_file", { op, from, to });
    return { op, from, to, bytes, dryRun: false };
  }

  // move: rename (stesso disco) con fallback copy+delete
  try {
    await fs.rename(rFrom.abs, rTo.abs);
  } catch {
    await copyRecursive(rFrom.abs, rTo.abs);
    await fs.rm(rFrom.abs, { recursive: true, force: true });
  }
  void stFrom;
  ctx.logger.info("move_file", { op, from, to });
  return { op, from, to, dryRun: false };
}
