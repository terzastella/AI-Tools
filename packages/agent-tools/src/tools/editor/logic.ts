import { promises as fs } from "node:fs";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export type EditorMode = "replace" | "insertAt" | "deleteRange";

export interface EditorInput {
  path: string;
  mode?: EditorMode;
  /** replace */
  oldString?: string;
  newString?: string;
  replaceAll?: boolean;
  /** insertAt (1-indexed, line = dove inserire PRIMA; line = n+1 appende) */
  line?: number;
  content?: string;
  /** deleteRange inclusive 1-indexed */
  startLine?: number;
  endLine?: number;
  /** se true scrive backup .bak */
  backup?: boolean;
  dryRun?: boolean;
}

export interface EditorOutput {
  path: string;
  abs: string;
  mode: EditorMode;
  bytes: number;
  replacements?: number;
  preview: string;
  dryRun: boolean;
  backupPath?: string;
}

export const EDITOR_VERSION = "1.0.0";

function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = hay.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

function previewDiff(before: string, after: string, maxChars = 800): string {
  // Preview compatta: prime righe cambiate. v1 semplice, ottimizzabile dopo.
  const b = before.split("\n");
  const a = after.split("\n");
  const out: string[] = [];
  const n = Math.max(b.length, a.length);
  let shown = 0;
  for (let i = 0; i < n && shown < 40; i++) {
    if (b[i] !== a[i]) {
      out.push(`L${i + 1} - ${b[i] ?? ""}`.slice(0, 200));
      out.push(`L${i + 1} + ${a[i] ?? ""}`.slice(0, 200));
      shown += 2;
    }
  }
  const s = out.join("\n");
  return s.length > maxChars ? s.slice(0, maxChars) + "\n…(truncated)" : s || "(no visible change)";
}

export async function editorLogic(ctx: ToolContext, input: EditorInput): Promise<EditorOutput> {
  const rel = (input.path ?? "").trim();
  if (!rel) throw Object.assign(new Error("path is required"), { code: "BAD_ARGS" });
  const mode: EditorMode = input.mode ?? "replace";
  const dryRun = input.dryRun ?? false;
  const backup = input.backup ?? false;

  const resolved = resolveSafePath(ctx, rel);
  if (!resolved.ok) throw Object.assign(new Error(`path escapes cwd: ${rel}`), { code: "PATH_TRAVERSAL" });
  const abs = resolved.abs;

  let before: string;
  try {
    before = await fs.readFile(abs, "utf8");
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw Object.assign(new Error(`file not found: ${rel}`), { code: "NOT_FOUND" });
    }
    throw e;
  }

  let after: string = before;
  let replacements: number | undefined;

  if (mode === "replace") {
    const oldString = input.oldString ?? "";
    const newString = input.newString ?? "";
    if (!oldString) throw Object.assign(new Error("oldString is required for replace"), { code: "BAD_ARGS" });
    if (oldString === newString)
      throw Object.assign(new Error("oldString and newString are identical"), { code: "NOOP" });
    const occurrences = countOccurrences(before, oldString);
    if (occurrences === 0) throw Object.assign(new Error("oldString not found"), { code: "NOT_FOUND_STRING" });
    const replaceAll = input.replaceAll ?? false;
    if (occurrences > 1 && !replaceAll) {
      throw Object.assign(new Error(`oldString matches ${occurrences} times (use replaceAll:true)`), {
        code: "AMBIGUOUS",
      });
    }
    after = replaceAll ? before.split(oldString).join(newString) : before.replace(oldString, newString);
    replacements = replaceAll ? occurrences : 1;
  } else if (mode === "insertAt") {
    const line = input.line ?? 0;
    const content = input.content ?? "";
    if (!Number.isInteger(line) || line < 1) throw Object.assign(new Error("line must be >= 1"), { code: "BAD_ARGS" });
    const lines = before.split("\n");
    if (line > lines.length + 1)
      throw Object.assign(new Error(`line ${line} out of range (1..${lines.length + 1})`), { code: "OUT_OF_RANGE" });
    lines.splice(line - 1, 0, content);
    after = lines.join("\n");
  } else if (mode === "deleteRange") {
    const startLine = input.startLine ?? 0;
    const endLine = input.endLine ?? 0;
    if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine) {
      throw Object.assign(new Error("startLine/endLine invalid"), { code: "BAD_ARGS" });
    }
    const lines = before.split("\n");
    if (endLine > lines.length)
      throw Object.assign(new Error(`endLine ${endLine} out of range`), { code: "OUT_OF_RANGE" });
    lines.splice(startLine - 1, endLine - startLine + 1);
    after = lines.join("\n");
  } else {
    throw Object.assign(new Error(`unknown mode: ${mode}`), { code: "BAD_ARGS" });
  }

  const preview = previewDiff(before, after);
  const bytes = Buffer.byteLength(after, "utf8");

  if (dryRun) {
    const out: EditorOutput = { path: rel, abs, mode, bytes, preview, dryRun: true };
    if (replacements !== undefined) out.replacements = replacements;
    return out;
  }

  let backupPath: string | undefined;
  if (backup) {
    backupPath = `${abs}.bak`;
    await fs.writeFile(backupPath, before, "utf8");
  }

  const tmp = `${abs}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, after, "utf8");
  await fs.rename(tmp, abs);

  ctx.logger.info("edit_file", { path: rel, mode, replacements });
  const out: EditorOutput = { path: rel, abs, mode, bytes, preview, dryRun: false };
  if (replacements !== undefined) out.replacements = replacements;
  if (backupPath !== undefined) out.backupPath = backupPath;
  return out;
}
