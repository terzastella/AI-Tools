import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface AstSearchInput {
  symbol?: string;
  kind?: "function" | "class" | "interface" | "import" | "all";
  paths?: string[];
  lang?: "ts" | "js" | "py" | "auto";
  maxResults?: number;
}

export interface AstMatch {
  path: string;
  line: number;
  kind: string;
  name: string;
  snippet: string;
}

export interface AstSearchOutput {
  matches: AstMatch[];
  engine: "ts-ast" | "regex";
  truncated: boolean;
}

export const AST_SEARCH_VERSION = "1.0.0";

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".agent", "__pycache__", ".venv"]);
const EXT_BY_LANG: Record<string, string[]> = {
  ts: [".ts", ".tsx", ".mts", ".cts"],
  js: [".js", ".jsx", ".mjs", ".cjs"],
  py: [".py"],
};

function langOf(file: string, forced: string): string {
  if (forced !== "auto") return forced;
  const ext = path.extname(file).toLowerCase();
  if (EXT_BY_LANG["ts"]!.includes(ext)) return "ts";
  if (EXT_BY_LANG["js"]!.includes(ext)) return "js";
  if (ext === ".py") return "py";
  return "ts";
}

async function collectFiles(ctx: ToolContext, rels: string[], exts: Set<string>): Promise<string[]> {
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
    if (exts.has(path.extname(r.abs).toLowerCase())) out.push(rel.replace(/\\/g, "/"));
  };
  for (const p of rels) await walk(p);
  return out;
}

interface RawHit {
  line: number;
  kind: string;
  name: string;
  snippet: string;
}

function regexHits(content: string, lang: string, symbol: string, kind: string): RawHit[] {
  const lines = content.split("\n");
  const out: RawHit[] = [];
  const sym = symbol.toLowerCase();
  const wants = (k: string, name: string): boolean => {
    if (kind !== "all" && k !== kind) return false;
    if (sym && !name.toLowerCase().includes(sym)) return false;
    return true;
  };
  const pats: { kind: string; re: RegExp }[] =
    lang === "py"
      ? [
          { kind: "function", re: /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)/ },
          { kind: "class", re: /^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)/ },
          { kind: "import", re: /^\s*(?:import\s+(.+)|from\s+(\S+)\s+import)/ },
        ]
      : [
          { kind: "function", re: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/ },
          { kind: "function", re: /^\s*(?:export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(/ },
          { kind: "function", re: /^\s*(?:export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?[^=]*=>/ },
          { kind: "class", re: /^\s*(?:export\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/ },
          { kind: "interface", re: /^\s*(?:export\s+)?interface\s+([A-Za-z_$][A-Za-z0-9_$]*)/ },
          { kind: "import", re: /^\s*import\s+(?:(.+?)\s+from\s+)?['"]([^'"]+)['"]/ },
        ];
  lines.forEach((ln, i) => {
    for (const p of pats) {
      const m = p.re.exec(ln);
      if (!m) continue;
      const name = (m[1] ?? m[2] ?? "").trim().slice(0, 120);
      if (wants(p.kind, name)) {
        out.push({ line: i + 1, kind: p.kind, name, snippet: lines.slice(i, i + 3).join("\n").slice(0, 300) });
      }
      break;
    }
  });
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tsAstHits(content: string, file: string, symbol: string, kind: string): Promise<RawHit[] | null> {
  let ts: any;
  try {
    ts = await import("typescript");
  } catch {
    return null;
  }
  const lines = content.split("\n");
  const out: RawHit[] = [];
  const sym = symbol.toLowerCase();
  const wants = (k: string, name: string): boolean => {
    if (kind !== "all" && k !== kind) return false;
    if (sym && !name.toLowerCase().includes(sym)) return false;
    return true;
  };
  let sf: any;
  try {
    sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  } catch {
    return null;
  }
  const at = (pos: number): number => content.slice(0, pos).split("\n").length;
  const snippetAt = (node: any): string => {
    const start = node.getStart ? node.getStart(sf) : node.pos;
    return content.slice(start, start + 200).split("\n").slice(0, 3).join("\n");
  };
  const visit = (node: any): void => {
    const SyntaxKind = ts.SyntaxKind;
    if (node.kind === SyntaxKind.FunctionDeclaration && node.name) {
      const name = node.name.text;
      if (wants("function", name)) out.push({ line: at(node.getStart(sf)), kind: "function", name, snippet: snippetAt(node) });
    } else if (node.kind === SyntaxKind.ClassDeclaration && node.name) {
      const name = node.name.text;
      if (wants("class", name)) out.push({ line: at(node.getStart(sf)), kind: "class", name, snippet: snippetAt(node) });
    } else if (node.kind === SyntaxKind.InterfaceDeclaration && node.name) {
      const name = node.name.text;
      if (wants("interface", name)) out.push({ line: at(node.getStart(sf)), kind: "interface", name, snippet: snippetAt(node) });
    } else if (node.kind === SyntaxKind.VariableStatement) {
      const decls = node.declarationList?.declarations ?? [];
      for (const d of decls) {
        const init = d.initializer;
        if (!init) continue;
        const isFn = init.kind === SyntaxKind.ArrowFunction || init.kind === SyntaxKind.FunctionExpression;
        if (!isFn || !d.name || d.name.kind !== SyntaxKind.Identifier) continue;
        const name = d.name.text;
        if (wants("function", name)) out.push({ line: at(d.getStart(sf)), kind: "function", name, snippet: snippetAt(d) });
      }
    } else if (node.kind === SyntaxKind.ImportDeclaration) {
      const mod = node.moduleSpecifier?.text ?? "";
      if (wants("import", mod)) out.push({ line: at(node.getStart(sf)), kind: "import", name: mod.slice(0, 120), snippet: snippetAt(node) });
    }
    ts.forEachChild(node, visit);
  };
  try {
    visit(sf);
  } catch {
    return null;
  }
  return out;
}

export async function astSearchLogic(ctx: ToolContext, input: AstSearchInput): Promise<AstSearchOutput> {
  const symbol = (input.symbol ?? "").trim().slice(0, 200);
  const kind = input.kind ?? "all";
  if (!["function", "class", "interface", "import", "all"].includes(kind)) {
    throw Object.assign(new Error("kind must be function|class|interface|import|all"), { code: "BAD_ARGS" });
  }
  const lang = input.lang ?? "auto";
  if (!["ts", "js", "py", "auto"].includes(lang)) throw Object.assign(new Error("lang must be ts|js|py|auto"), { code: "BAD_ARGS" });
  const rels = input.paths && input.paths.length > 0 ? input.paths : ["."];
  if (rels.length > 20) throw Object.assign(new Error("paths max 20"), { code: "BAD_ARGS" });
  const maxResults = input.maxResults ?? 50;
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 200) {
    throw Object.assign(new Error("maxResults must be 1..200"), { code: "BAD_ARGS" });
  }

  const exts = new Set<string>([...(EXT_BY_LANG["ts"] ?? []), ...(EXT_BY_LANG["js"] ?? []), ...(EXT_BY_LANG["py"] ?? [])]);
  const files = await collectFiles(ctx, rels.map((p) => String(p)), exts);
  const matches: AstMatch[] = [];
  let engine: "ts-ast" | "regex" = "regex";
  let usedAst = false;
  let usedRegex = false;

  for (const f of files) {
    if (matches.length >= maxResults) break;
    const r = resolveSafePath(ctx, f);
    if (!r.ok) continue;
    let content: string;
    try {
      const st = await fs.stat(r.abs);
      if (st.size > 200_000) continue;
      content = await fs.readFile(r.abs, "utf8");
    } catch {
      continue;
    }
    if (content.includes("\0")) continue;
    const fileLang = langOf(f, lang);
    let hits: RawHit[] | null = null;
    if (fileLang === "ts" || fileLang === "js") {
      hits = await tsAstHits(content, f, symbol, kind);
      if (hits) usedAst = true;
    }
    if (!hits) {
      hits = regexHits(content, fileLang, symbol, kind);
      usedRegex = true;
    }
    for (const h of hits) {
      if (matches.length >= maxResults) break;
      matches.push({ path: f, line: h.line, kind: h.kind, name: h.name, snippet: h.snippet });
    }
  }
  engine = usedAst && !usedRegex ? "ts-ast" : "regex";
  ctx.logger.info("ast_search", { files: files.length, matches: matches.length, engine });
  return { matches, engine, truncated: matches.length >= maxResults };
}
