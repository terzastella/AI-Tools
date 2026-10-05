import type { ToolContext } from "../../core/context.js";

export interface ChunkTextInput {
  text: string;
  max_chars?: number;
  overlap?: number;
}

export interface ChunkTextOutput {
  chunks: string[];
  count: number;
}

export const CHUNK_TEXT_VERSION = "1.0.0";

/** Port di py-ref/chunker.py: split a caratteri, preferisce tagliare su newline poi spazio. */
export function chunkText(text: string, maxChars = 1000, overlap = 100): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxChars) return [t];
  if (overlap >= maxChars) throw Object.assign(new Error("overlap must be < max_chars"), { code: "BAD_ARGS" });

  const chunks: string[] = [];
  let start = 0;
  const n = t.length;
  while (start < n) {
    let end = Math.min(start + maxChars, n);
    if (end < n) {
      const cutNl = t.lastIndexOf("\n", end - 1);
      const cutSp = t.lastIndexOf(" ", end - 1);
      let cut = -1;
      if (cutNl > start + Math.floor(maxChars / 3)) cut = cutNl;
      else if (cutSp > start + Math.floor(maxChars / 3)) cut = cutSp;
      if (cut !== -1 && cut > start) end = cut;
    }
    const piece = t.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= n) break;
    start = Math.max(end - overlap, start + 1);
    if (chunks.length > 500) break;
  }
  return chunks;
}

export async function chunkTextLogic(_ctx: ToolContext, input: ChunkTextInput): Promise<ChunkTextOutput> {
  const text = input.text ?? "";
  if (typeof text !== "string") throw Object.assign(new Error("text must be a string"), { code: "BAD_ARGS" });
  const maxChars = input.max_chars ?? 1000;
  const overlap = input.overlap ?? 100;
  if (!Number.isInteger(maxChars) || maxChars < 100 || maxChars > 50_000) {
    throw Object.assign(new Error("max_chars must be 100..50000"), { code: "BAD_ARGS" });
  }
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= maxChars) {
    throw Object.assign(new Error("overlap must be 0..max_chars-1"), { code: "BAD_ARGS" });
  }
  if (text.length > 500_000) throw Object.assign(new Error("text too big (max 500k chars)"), { code: "TOO_BIG" });
  const chunks = chunkText(text, maxChars, overlap);
  return { chunks, count: chunks.length };
}
