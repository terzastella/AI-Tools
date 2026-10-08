import { promises as fs } from "node:fs";
import { inflateSync } from "node:zlib";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface ImageReadInput {
  path: string;
  maxBytes?: number;
}

export interface ImageReadOutput {
  path: string;
  mime: string;
  sizeBytes: number;
  base64: string;
  text?: string;
  note?: string;
}

export const IMAGE_READ_VERSION = "1.0.0";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

/** Testo best-effort da PDF: stringhe letterali + stream FlateDecode. Non è un parser completo. */
function pdfTextBestEffort(buf: Buffer): string {
  const parts: string[] = [];
  const ascii = buf.toString("latin1");
  const lit = ascii.match(/\((?:\\.|[^\\()])*\)/g);
  if (lit) {
    for (const s of lit.slice(0, 2000)) {
      const inner = s.slice(1, -1).replace(/\\([nrtbf()\\])/g, "$1");
      if (inner.trim().length >= 3) parts.push(inner);
      if (parts.join(" ").length > 20_000) break;
    }
  }
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  let tried = 0;
  while ((m = streamRe.exec(ascii)) !== null && tried < 50) {
    tried++;
    const raw = Buffer.from(m[1]!, "latin1");
    try {
      const inflated = inflateSync(raw).toString("latin1");
      const inner = inflated.match(/\((?:\\.|[^\\()])*\)/g);
      if (inner) {
        for (const s of inner.slice(0, 500)) {
          const t = s.slice(1, -1).replace(/\\([nrtbf()\\])/g, "$1");
          if (t.trim().length >= 3) parts.push(t);
          if (parts.join(" ").length > 20_000) break;
        }
      }
    } catch {
      /* non compresso o altro filtro: ignora */
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 20_000);
}

export async function imageReadLogic(ctx: ToolContext, input: ImageReadInput): Promise<ImageReadOutput> {
  const rel = (input.path ?? "").trim();
  if (!rel) throw Object.assign(new Error("path is required"), { code: "BAD_ARGS" });
  const maxBytes = input.maxBytes ?? 5_000_000;
  if (!Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > 20_000_000) {
    throw Object.assign(new Error("maxBytes must be 1024..20000000"), { code: "BAD_ARGS" });
  }
  const r = resolveSafePath(ctx, rel);
  if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${rel}`), { code: "PATH_TRAVERSAL" });
  const ext = path.extname(r.abs).toLowerCase();
  const mime = MIME[ext];
  if (!mime)
    throw Object.assign(new Error(`unsupported type ${ext || "(none)"} (png/jpg/webp/gif/pdf)`), { code: "BAD_TYPE" });

  let st;
  try {
    st = await fs.stat(r.abs);
  } catch {
    throw Object.assign(new Error(`file not found: ${rel}`), { code: "NOT_FOUND" });
  }
  if (!st.isFile()) throw Object.assign(new Error(`not a file: ${rel}`), { code: "NOT_FOUND" });
  if (st.size > maxBytes) throw Object.assign(new Error(`file too big: ${st.size} > ${maxBytes}`), { code: "TOO_BIG" });

  const buf = await fs.readFile(r.abs);
  const base64 = buf.toString("base64");
  ctx.logger.info("image_read", { path: rel, mime, size: st.size });
  if (mime === "application/pdf") {
    return {
      path: rel,
      mime,
      sizeBytes: st.size,
      base64,
      text: pdfTextBestEffort(buf),
      note: "PDF text is best-effort, non è un parser completo",
    };
  }
  return { path: rel, mime, sizeBytes: st.size, base64 };
}
