import { promises as fs } from "node:fs";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface FileOutlineInput {
  path: string;
  maxSymbols?: number;
}

export interface FileSymbol {
  name: string;
  line: number;
  kind: string;
}

export interface FileOutlineOutput {
  path: string;
  abs: string;
  symbols: FileSymbol[];
  truncated: boolean;
}

export const FILE_OUTLINE_VERSION = "1.0.0";

const RULES: { kind: string; re: RegExp }[] = [
  { kind: "import", re: /^import\s.+from\s+['"].+['"]/ },
  { kind: "export-function", re: /^export\s+(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)/ },
  { kind: "export-class", re: /^export\s+(?:abstract\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/ },
  { kind: "export-interface", re: /^export\s+(?:interface|type|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/ },
  { kind: "export-const", re: /^export\s+(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/ },
  { kind: "function", re: /^(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)/ },
  { kind: "class", re: /^(?:abstract\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/ },
  { kind: "const-arrow", re: /^(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/ },
  { kind: "method", re: /^(?:public|private|protected|async\s+|static\s+)*(?:get\s+|set\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(.*\)\s*(?::\s*.+)?\s*\{?\s*$/ },
];

export async function fileOutlineLogic(ctx: ToolContext, input: FileOutlineInput): Promise<FileOutlineOutput> {
  const rel = (input.path ?? "").trim();
  if (!rel) throw Object.assign(new Error("path is required"), { code: "BAD_ARGS" });
  const maxSymbols = input.maxSymbols ?? 100;
  if (!Number.isInteger(maxSymbols) || maxSymbols < 1 || maxSymbols > 500) {
    throw Object.assign(new Error("maxSymbols must be 1..500"), { code: "BAD_ARGS" });
  }
  const r = resolveSafePath(ctx, rel);
  if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${rel}`), { code: "PATH_TRAVERSAL" });

  let content: string;
  try {
    const st = await fs.stat(r.abs);
    if (!st.isFile()) throw Object.assign(new Error(`not a file: ${rel}`), { code: "NOT_FILE" });
    if (st.size > 500_000) throw Object.assign(new Error(`file too big: ${rel}`), { code: "TOO_BIG" });
    content = await fs.readFile(r.abs, "utf8");
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw Object.assign(new Error(`file not found: ${rel}`), { code: "NOT_FOUND" });
    }
    throw e;
  }
  if (content.includes("\0")) throw Object.assign(new Error(`binary file: ${rel}`), { code: "BINARY" });

  const symbols: FileSymbol[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    for (const rule of RULES) {
      const m = rule.re.exec(trimmed);
      if (m) {
        const name = m[1] ?? trimmed.slice(0, 60);
        symbols.push({ name, line: i + 1, kind: rule.kind });
        break;
      }
    }
    if (symbols.length > maxSymbols) break;
  }
  const truncated = symbols.length > maxSymbols;
  return { path: rel, abs: r.abs, symbols: symbols.slice(0, maxSymbols), truncated };
}
