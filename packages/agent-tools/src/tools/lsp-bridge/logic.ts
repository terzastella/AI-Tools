import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface LspBridgeInput {
  op: "hover" | "references" | "rename";
  path: string;
  line: number;
  character?: number;
  symbol?: string;
  newName?: string;
  maxResults?: number;
}

export interface LspRef {
  path: string;
  line: number;
  character: number;
  snippet: string;
}

export interface LspRenameEdit {
  path: string;
  line: number;
  character: number;
  length: number;
  newName: string;
}

export interface LspBridgeOutput {
  op: string;
  hover?: string;
  references?: LspRef[];
  edits?: LspRenameEdit[];
  truncated: boolean;
}

export const LSP_BRIDGE_VERSION = "1.0.0";

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".agent", "__pycache__"]);
const TS_EXT = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadTs(): Promise<any | null> {
  try {
    return await import("typescript");
  } catch {
    return null;
  }
}

function offsetOf(content: string, line1: number, char1: number): number {
  const lines = content.split("\n");
  if (line1 < 1 || line1 > lines.length) throw Object.assign(new Error(`line out of range 1..${lines.length}`), { code: "BAD_ARGS" });
  const text = lines[line1 - 1] ?? "";
  let col = char1;
  if (!Number.isInteger(col) || col < 1) {
    throw Object.assign(new Error("character must be >= 1"), { code: "BAD_ARGS" });
  }
  if (col > text.length + 1) col = text.length + 1;
  return lines.slice(0, line1 - 1).join("\n").length + (line1 > 1 ? 1 : 0) + (col - 1);
}

function findSymbolCol(text: string, symbol: string): number {
  const i = text.indexOf(symbol);
  if (i === -1) throw Object.assign(new Error(`symbol not found on line: ${symbol}`), { code: "NOT_FOUND" });
  return i + 1;
}

async function projectFiles(ctx: ToolContext): Promise<string[]> {
  const out: string[] = [];
  const walk = async (rel: string): Promise<void> => {
    if (out.length >= 200) return;
    const r = resolveSafePath(ctx, rel);
    if (!r.ok) return;
    let st;
    try {
      st = await fs.stat(r.abs);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(path.basename(r.abs))) return;
      let entries: string[];
      try {
        entries = await fs.readdir(r.abs);
      } catch {
        return;
      }
      for (const e of entries) {
        if (out.length >= 200) return;
        await walk(path.join(rel, e));
      }
      return;
    }
    if (TS_EXT.has(path.extname(r.abs).toLowerCase())) out.push(r.abs);
  };
  await walk(".");
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function snippetOf(content: string, offset: number): { line: number; character: number; snippet: string } {
  const before = content.slice(0, offset).split("\n");
  const line = before.length;
  const character = (before[before.length - 1] ?? "").length + 1;
  const all = content.split("\n");
  const snippet = all
    .slice(Math.max(0, line - 2), line + 1)
    .join("\n")
    .slice(0, 300);
  return { line, character, snippet };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function lspBridgeLogic(ctx: ToolContext, input: LspBridgeInput): Promise<LspBridgeOutput> {
  const ts = await loadTs();
  if (!ts) {
    throw Object.assign(new Error("typescript module not found: install typescript per LSP vero (fallback: goto/refs)"), {
      code: "TYPESCRIPT_MISSING",
    });
  }
  const op = input.op ?? "";
  if (op !== "hover" && op !== "references" && op !== "rename") {
    throw Object.assign(new Error("op must be hover|references|rename"), { code: "BAD_ARGS" });
  }
  const rel = (input.path ?? "").trim();
  if (!rel) throw Object.assign(new Error("path is required"), { code: "BAD_ARGS" });
  const r = resolveSafePath(ctx, rel);
  if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${rel}`), { code: "PATH_TRAVERSAL" });
  const maxResults = input.maxResults ?? 50;
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 200) {
    throw Object.assign(new Error("maxResults must be 1..200"), { code: "BAD_ARGS" });
  }

  let content: string;
  try {
    content = await fs.readFile(r.abs, "utf8");
  } catch {
    throw Object.assign(new Error(`file not found: ${rel}`), { code: "NOT_FOUND" });
  }
  if (content.includes("\0")) throw Object.assign(new Error(`binary file: ${rel}`), { code: "BINARY" });

  const lineText = (content.split("\n")[input.line - 1] ?? "").toString();
  const character = input.character ?? (input.symbol ? findSymbolCol(lineText, input.symbol) : 1);
  const offset = offsetOf(content, input.line, character);

  const files = await projectFiles(ctx);
  if (!files.includes(r.abs)) files.push(r.abs);
  const versions = new Map<string, string>();
  const opts = {
    allowJs: true,
    checkJs: false,
    target: ts.ScriptTarget.ES2022,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    strict: false,
    noEmit: true,
    skipLibCheck: true,
  };
  const host = {
    getCompilationSettings: () => opts,
    getScriptFileNames: () => files,
    getScriptVersion: () => "0",
    getScriptSnapshot: (f: string) => {
      const cached = versions.get(f);
      if (cached !== undefined) return ts.ScriptSnapshot.fromString(cached);
      try {
        const c = readFileSync(f, "utf8");
        versions.set(f, c);
        return ts.ScriptSnapshot.fromString(c);
      } catch {
        return undefined;
      }
    },
    getCurrentDirectory: () => ctx.cwd,
    getDefaultLibFileName: (o: unknown) => ts.getDefaultLibFilePath(o),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };
  const ls = ts.createLanguageService(host);

  if (op === "hover") {
    const info = ls.getQuickInfoAtPosition(r.abs, offset);
    if (!info) throw Object.assign(new Error("no hover info here (prova su un simbolo)"), { code: "NOT_FOUND" });
    const text = `${ts.displayPartsToString(info.displayParts)}${info.documentation?.length ? "\n" + ts.displayPartsToString(info.documentation) : ""}`;
    return { op, hover: text.slice(0, 2000), truncated: text.length > 2000 };
  }

  if (op === "references") {
    const refs = ls.getReferencesAtPosition(r.abs, offset) ?? [];
    const out: LspRef[] = [];
    const readCached = (f: string): string => {
      const c = versions.get(f);
      if (c !== undefined) return c;
      try {
        const disk = readFileSync(f, "utf8");
        versions.set(f, disk);
        return disk;
      } catch {
        return "";
      }
    };
    for (const ref of refs.slice(0, maxResults)) {
      const fContent = readCached(ref.fileName);
      const s = snippetOf(fContent, ref.textSpan.start);
      out.push({ path: path.relative(ctx.cwd, ref.fileName).replace(/\\/g, "/") || ".", line: s.line, character: s.character, snippet: s.snippet });
    }
    return { op, references: out, truncated: refs.length > maxResults };
  }

  // rename dry: propone modifiche, non le applica (le applichi tu con edit_many)
  const newName = (input.newName ?? "").trim();
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(newName)) throw Object.assign(new Error("newName must be a valid identifier"), { code: "BAD_ARGS" });
  const locs = ls.findRenameLocations(r.abs, offset, false, false) ?? [];
  const edits: LspRenameEdit[] = [];
  for (const loc of locs.slice(0, maxResults)) {
    let fContent = versions.get(loc.fileName);
    if (fContent === undefined) {
      try {
        fContent = readFileSync(loc.fileName, "utf8");
      } catch {
        fContent = "";
      }
    }
    const s = snippetOf(fContent, loc.textSpan.start);
    edits.push({
      path: path.relative(ctx.cwd, loc.fileName).replace(/\\/g, "/") || ".",
      line: s.line,
      character: s.character,
      length: loc.textSpan.length,
      newName,
    });
  }
  return { op, edits, truncated: locs.length > maxResults };
}
