import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface WriterInput {
  path: string;
  content: string;
  overwrite?: boolean;
  mkdirs?: boolean;
  dryRun?: boolean;
}

export interface WriterOutput {
  path: string;
  abs: string;
  bytes: number;
  created: boolean;
  overwritten: boolean;
  dryRun: boolean;
  hash: string;
}

export const WRITER_VERSION = "1.0.0";

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);
}

export async function writerLogic(ctx: ToolContext, input: WriterInput): Promise<WriterOutput> {
  const rel = (input.path ?? "").trim();
  if (!rel) throw Object.assign(new Error("path is required"), { code: "BAD_ARGS" });
  if (typeof input.content !== "string") throw Object.assign(new Error("content must be a string"), { code: "BAD_ARGS" });

  const overwrite = input.overwrite ?? false;
  const mkdirs = input.mkdirs ?? true;
  const dryRun = input.dryRun ?? false;

  const resolved = resolveSafePath(ctx, rel);
  if (!resolved.ok) throw Object.assign(new Error(`path escapes cwd: ${rel}`), { code: "PATH_TRAVERSAL" });
  const abs = resolved.abs;

  let exists = false;
  try {
    const st = await fs.stat(abs);
    exists = st.isFile();
    if (st.isDirectory()) throw Object.assign(new Error(`target is a directory: ${rel}`), { code: "IS_DIRECTORY" });
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") throw e;
    exists = false;
  }

  if (exists && !overwrite) {
    throw Object.assign(new Error(`file exists (use overwrite:true): ${rel}`), { code: "EXISTS" });
  }

  const bytes = Buffer.byteLength(input.content, "utf8");
  const hash = sha256(input.content);

  if (dryRun) {
    return { path: rel, abs, bytes, created: !exists, overwritten: exists, dryRun: true, hash };
  }

  if (mkdirs) await fs.mkdir(path.dirname(abs), { recursive: true });

  // Atomic write: tmp + rename
  const tmp = `${abs}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, input.content, "utf8");
  await fs.rename(tmp, abs);

  ctx.logger.info("create_file", { path: rel, bytes, overwritten: exists });
  return { path: rel, abs, bytes, created: !exists, overwritten: exists, dryRun: false, hash };
}
