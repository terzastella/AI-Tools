import { promises as fs } from "node:fs";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface InspectSymbolInput {
  symbol: string;
  path: string;
  line?: number;
}

export interface InspectSymbolOutput {
  symbol: string;
  path: string;
  definitionLine: number | null;
  kind: string | null;
  typeHint: string | null;
  context: string[];
}

export const INSPECT_SYMBOL_VERSION = "1.0.0";

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function inspectSymbolLogic(ctx: ToolContext, input: InspectSymbolInput): Promise<InspectSymbolOutput> {
  const symbol = (input.symbol ?? "").trim();
  if (!IDENT_RE.test(symbol)) throw Object.assign(new Error("symbol must be an identifier"), { code: "BAD_ARGS" });
  const rel = (input.path ?? "").trim();
  if (!rel) throw Object.assign(new Error("path is required"), { code: "BAD_ARGS" });
  const r = resolveSafePath(ctx, rel);
  if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${rel}`), { code: "PATH_TRAVERSAL" });

  let content: string;
  try {
    const st = await fs.stat(r.abs);
    if (st.size > 500_000) throw Object.assign(new Error("file too big"), { code: "TOO_BIG" });
    content = await fs.readFile(r.abs, "utf8");
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw Object.assign(new Error(`file not found: ${rel}`), { code: "NOT_FOUND" });
    }
    throw e;
  }
  if (content.includes("\0")) throw Object.assign(new Error("binary file"), { code: "BINARY" });

  const lines = content.split("\n");
  const defRe = new RegExp(`\\b(?:function|class|interface|type|enum|const|let|var)\\s+${esc(symbol)}\\b`);
  let definitionLine: number | null = null;
  let kind: string | null = null;
  let typeHint: string | null = null;

  const hint = input.line;
  const searchOrder: number[] =
    hint !== undefined && Number.isInteger(hint) && hint >= 1 && hint <= lines.length
      ? [hint - 1, ...lines.map((_, i) => i).filter((i) => i !== hint - 1)]
      : lines.map((_, i) => i);

  for (const i of searchOrder) {
    const t = lines[i]!.trim();
    if (defRe.test(t)) {
      definitionLine = i + 1;
      if (/^export|^\s*(?:async\s+)?function/.test(t)) kind = "function";
      else if (/class/.test(t)) kind = "class";
      else if (/interface|type|enum/.test(t)) kind = "type";
      else kind = "variable";
      const tm =
        new RegExp(`${esc(symbol)}\\s*:\\s*([^=;{]+)`).exec(t) ??
        /\)\s*:\s*([^={;]+)/.exec(t) ??
        /\(\s*[^)]*?([A-Za-z_][A-Za-z0-9_]*\s*:\s*[^,)]+)/.exec(t);
      if (tm) typeHint = tm[1]!.trim().slice(0, 120);
      break;
    }
  }
  if (definitionLine === null) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.includes(symbol)) {
        definitionLine = i + 1;
        kind = "usage";
        break;
      }
    }
  }

  const anchor = definitionLine ?? hint ?? 1;
  const context = lines.slice(Math.max(0, anchor - 6), Math.min(lines.length, anchor + 5)).map((l) => l.slice(0, 200));

  return { symbol, path: rel, definitionLine, kind, typeHint, context };
}
