import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface PackContextInput {
  paths: string[];
  max_chars?: number;
  ext_skip?: string[];
}

export interface PackContextOutput {
  packed: string;
  files: string[];
  total_chars: number;
  est_tokens: number;
  truncated: boolean;
}

export const PACK_CONTEXT_VERSION = "1.0.0";

const DEFAULT_SKIP = new Set([".pyc", ".png", ".jpg", ".jpeg", ".zip", ".exe", ".bin"]);

export async function packContextLogic(ctx: ToolContext, input: PackContextInput): Promise<PackContextOutput> {
  const paths = input.paths ?? [];
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 50) {
    throw Object.assign(new Error("paths must be an array 1..50"), { code: "BAD_ARGS" });
  }
  const maxChars = input.max_chars ?? 12_000;
  if (!Number.isInteger(maxChars) || maxChars < 500 || maxChars > 200_000) {
    throw Object.assign(new Error("max_chars must be 500..200000"), { code: "BAD_ARGS" });
  }
  const extraSkip: string[] = Array.isArray(input.ext_skip) ? input.ext_skip : [];
  const skip = new Set<string>([...DEFAULT_SKIP]);
  for (const e of extraSkip) {
    if (typeof e !== "string") continue;
    skip.add(e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`);
  }

  const files: string[] = [];
  let packed = "";
  let truncated = false;

  const consider = async (rel: string): Promise<void> => {
    const r = resolveSafePath(ctx, rel);
    if (!r.ok) return;
    let st;
    try {
      st = await fs.stat(r.abs);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      let entries: string[];
      try {
        entries = await fs.readdir(r.abs);
      } catch {
        return;
      }
      for (const e of entries.slice(0, 50)) {
        if (packed.length >= maxChars) {
          truncated = true;
          return;
        }
        await consider(path.join(rel, e));
      }
      return;
    }
    if (!st.isFile() || st.size > 200_000) return;
    if (skip.has(path.extname(r.abs).toLowerCase())) return;
    let content: string;
    try {
      content = await fs.readFile(r.abs, "utf8");
    } catch {
      return;
    }
    if (content.includes("\0")) return;
    const block = `=== ${rel.replace(/\\/g, "/")} ===\n${content}\n`;
    if (packed.length + block.length > maxChars) {
      truncated = true;
      return;
    }
    packed += block;
    files.push(rel.replace(/\\/g, "/"));
  };

  for (const p of paths) {
    if (typeof p !== "string" || !p.trim()) continue;
    await consider(p.trim());
    if (packed.length >= maxChars) {
      truncated = true;
      break;
    }
  }

  ctx.logger.info("pack_context", { files: files.length, chars: packed.length });
  return { packed, files, total_chars: packed.length, est_tokens: Math.floor(packed.length / 4), truncated };
}
