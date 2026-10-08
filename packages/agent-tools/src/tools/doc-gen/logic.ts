import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";
import { preparerLogic } from "../preparer/logic.js";

export interface GenerateDocsInput {
  paths?: string[];
  maxFiles?: number;
  style?: "markdown" | "jsdoc";
  includePrivate?: boolean;
}

export interface DocEntry {
  path: string;
  exports: string[];
  functions: string[];
  markdown: string;
}

export interface GenerateDocsOutput {
  docs: DocEntry[];
  indexMd: string;
  truncated: boolean;
}

export const DOC_GEN_VERSION = "1.0.0";

const EXPORT_RE = /^export\s+(?:async\s+)?(?:function|const|class|interface|type|enum)\s+([A-Za-z0-9_]+)/gm;
const FUNC_RE = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/gm;

export async function docGenLogic(ctx: ToolContext, input: GenerateDocsInput): Promise<GenerateDocsOutput> {
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["src"];
  const maxFiles = input.maxFiles ?? 20;
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 100) {
    throw Object.assign(new Error("maxFiles must be 1..100"), { code: "BAD_ARGS" });
  }
  const style = input.style ?? "markdown";
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
  }

  const prep = await preparerLogic(ctx, {
    goal: "export function const class interface type",
    paths: rawPaths,
    maxFiles,
  });
  const docs: DocEntry[] = [];

  for (const f of prep.files) {
    if (!/\.(ts|js|mjs|cjs|tsx|jsx)$/.test(f.path)) continue;
    const abs = resolveSafePath(ctx, f.path);
    if (!abs.ok) continue;
    let content: string;
    try {
      content = await fs.readFile(abs.abs, "utf8");
    } catch {
      continue;
    }
    if (content.includes("\0")) continue;
    const exports: string[] = [];
    let m: RegExpExecArray | null;
    EXPORT_RE.lastIndex = 0;
    while ((m = EXPORT_RE.exec(content)) !== null) exports.push(m[1]!);
    const functions: string[] = [];
    FUNC_RE.lastIndex = 0;
    while ((m = FUNC_RE.exec(content)) !== null) {
      if (!functions.includes(m[1]!)) functions.push(m[1]!);
    }
    const firstLines = content.split("\n").slice(0, 10).join("\n").slice(0, 600);
    const markdown =
      style === "jsdoc"
        ? `/** ${path.basename(f.path)} — ${exports.slice(0, 5).join(", ") || "no exports"} */\n`
        : `# ${f.path}\n\nExports: ${exports.join(", ") || "—"}\n\nFunctions: ${functions.join(", ") || "—"}\n\n\`\`\`ts\n${firstLines}\n\`\`\`\n`;
    docs.push({ path: f.path, exports, functions, markdown });
  }

  const indexMd = `# Index\n\n${docs.map((d) => `- [${d.path}](#) — ${d.exports.slice(0, 3).join(", ") || "no exports"}`).join("\n")}\n`;
  ctx.logger.info("generate_docs", { files: docs.length });
  return { docs, indexMd, truncated: prep.truncated };
}
