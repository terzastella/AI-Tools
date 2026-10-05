import { promises as fs } from "node:fs";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface ReadInput {
  path: string;
  offset?: number;
  limit?: number;
}

export interface ReadOutput {
  path: string;
  abs: string;
  lines: string[];
  totalLines: number;
  offset: number;
  truncated: boolean;
}

export const READ_VERSION = "1.0.0";

export async function readLogic(ctx: ToolContext, input: ReadInput): Promise<ReadOutput> {
  const rel = (input.path ?? "").trim();
  if (!rel) throw Object.assign(new Error("path is required"), { code: "BAD_ARGS" });
  const offset = input.offset ?? 1;
  const limit = input.limit ?? 200;
  if (!Number.isInteger(offset) || offset < 1) throw Object.assign(new Error("offset must be >= 1"), { code: "BAD_ARGS" });
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw Object.assign(new Error("limit must be 1..1000"), { code: "BAD_ARGS" });
  }

  const r = resolveSafePath(ctx, rel);
  if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${rel}`), { code: "PATH_TRAVERSAL" });

  let st: Awaited<ReturnType<typeof fs.stat>>;
  try {
    st = await fs.stat(r.abs);
  } catch {
    throw Object.assign(new Error(`file not found: ${rel}`), { code: "NOT_FOUND" });
  }
  if (!st.isFile()) throw Object.assign(new Error(`not a file: ${rel}`), { code: "NOT_FOUND" });
  if (st.size > 500_000) throw Object.assign(new Error(`file too big: ${rel}`), { code: "TOO_BIG" });

  let content: string;
  try {
    content = await fs.readFile(r.abs, "utf8");
  } catch {
    throw Object.assign(new Error(`file not found: ${rel}`), { code: "NOT_FOUND" });
  }
  if (content.includes("\0")) throw Object.assign(new Error(`binary file: ${rel}`), { code: "BINARY" });

  const all = content.split("\n");
  const totalLines = all.length;
  const slice = all.slice(offset - 1, offset - 1 + limit);
  const truncated = offset - 1 + limit < totalLines;

  ctx.logger.info("read_file", { path: rel, offset, limit });
  return { path: rel, abs: r.abs, lines: slice, totalLines, offset, truncated };
}
