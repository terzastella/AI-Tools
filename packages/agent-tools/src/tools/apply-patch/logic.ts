import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface ApplyPatchInput {
  patch: string;
  dryRun?: boolean;
  stripPrefix?: number;
  /** Se true (default) ignora spazi finali e cerca 2 righe più in là. */
  fuzzy?: boolean;
}

export interface AppliedFile {
  path: string;
  abs: string;
  hunks: number;
  added: number;
  removed: number;
}

export interface ApplyPatchOutput {
  files: AppliedFile[];
  preview: string;
  dryRun: boolean;
}

export const APPLY_PATCH_VERSION = "1.1.0";

interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: { kind: " " | "+" | "-"; text: string }[];
}

interface FilePatch {
  oldPath: string;
  newPath: string;
  hunks: Hunk[];
}

function strip(pathStr: string, n: number): string {
  const parts = pathStr.replace(/\\/g, "/").split("/");
  if (parts[0] === "a" || parts[0] === "b") parts.shift();
  for (let i = 1; i < n; i++) parts.shift();
  return parts.join("/");
}

function parsePatch(patch: string): FilePatch[] {
  const lines = patch.split("\n");
  const files: FilePatch[] = [];
  let cur: FilePatch | undefined;
  let hunk: Hunk | undefined;

  const hunkRe = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
  for (const raw of lines) {
    if (raw.startsWith("--- ")) {
      const p = raw.slice(4).trim().split("\t")[0]!.trim();
      if (cur && cur.newPath === "") {
        cur.oldPath = p;
      } else {
        cur = { oldPath: p, newPath: "", hunks: [] };
        files.push(cur);
      }
      hunk = undefined;
    } else if (raw.startsWith("+++ ")) {
      const p = raw.slice(4).trim().split("\t")[0]!.trim();
      if (!cur) {
        cur = { oldPath: "", newPath: p, hunks: [] };
        files.push(cur);
      } else {
        cur.newPath = p;
      }
      hunk = undefined;
    } else if (raw.startsWith("@@")) {
      const m = hunkRe.exec(raw);
      if (!m || !cur) throw Object.assign(new Error(`invalid hunk header: ${raw}`), { code: "BAD_PATCH" });
      hunk = {
        oldStart: Number(m[1]),
        oldLines: m[2] !== undefined ? Number(m[2]) : 1,
        newStart: Number(m[3]),
        newLines: m[4] !== undefined ? Number(m[4]) : 1,
        lines: [],
      };
      cur.hunks.push(hunk);
    } else if (hunk && (raw.startsWith(" ") || raw.startsWith("+") || raw.startsWith("-") || raw === "")) {
      const kind = (raw.charAt(0) === "+" ? "+" : raw.charAt(0) === "-" ? "-" : " ") as Hunk["lines"][number]["kind"];
      const text = raw.length > 0 && (kind === "+" || kind === "-" || raw.charAt(0) === " ") ? raw.slice(1) : raw;
      hunk.lines.push({ kind, text });
    } else if (
      raw.startsWith("diff --git") ||
      raw.startsWith("index ") ||
      raw.startsWith("new file") ||
      raw.startsWith("deleted file")
    ) {
      continue;
    } else if (raw.trim() === "" && !hunk) {
      continue;
    }
  }
  const valid = files.filter((f) => f.hunks.length > 0 && f.newPath);
  if (valid.length === 0) throw Object.assign(new Error("no hunks found"), { code: "BAD_PATCH" });
  return valid;
}

const norm = (s: string): string => s.replace(/[ \t]+$/g, "");

function findNearby(origLines: string[], expected: string, cursor: number, fuzzy: boolean): number {
  const cur = origLines[cursor - 1] ?? "";
  if (cur === expected) return cursor;
  if (fuzzy && norm(cur) === norm(expected)) return cursor;
  if (!fuzzy) return -1;
  for (const d of [1, -1, 2, -2]) {
    const c = origLines[cursor + d - 1] ?? "";
    if (c === expected || norm(c) === norm(expected)) return cursor + d;
  }
  return -1;
}

function applyHunks(
  original: string,
  hunks: Hunk[],
  rel: string,
  fuzzy: boolean,
): { content: string; added: number; removed: number } {
  const origLines = original.split("\n");
  const out: string[] = [];
  let cursor = 1;
  let added = 0;
  let removed = 0;
  for (const h of hunks) {
    const start = h.oldStart === 0 ? 1 : h.oldStart;
    while (cursor < start && cursor <= origLines.length) {
      out.push(origLines[cursor - 1] ?? "");
      cursor++;
    }
    // fuzzy: se il primo contesto non torna, cerca lo start giusto entro ±2
    if (fuzzy && h.lines.length > 0) {
      const first = h.lines.find((l) => l.kind !== "+");
      if (first) {
        const found = findNearby(origLines, first.text, cursor, true);
        if (found !== -1 && found !== cursor) {
          while (cursor < found) {
            out.push(origLines[cursor - 1] ?? "");
            cursor++;
          }
        }
      }
    }
    for (const l of h.lines) {
      if (l.kind === " ") {
        const found = findNearby(origLines, l.text, cursor, fuzzy);
        if (found === -1) {
          throw Object.assign(
            new Error(`context mismatch in ${rel} at line ${cursor}: expected "${l.text.slice(0, 60)}"`),
            { code: "CONTEXT_MISMATCH" },
          );
        }
        while (cursor < found) {
          out.push(origLines[cursor - 1] ?? "");
          cursor++;
        }
        out.push(origLines[cursor - 1] ?? "");
        cursor++;
      } else if (l.kind === "-") {
        const found = findNearby(origLines, l.text, cursor, fuzzy);
        if (found === -1) {
          throw Object.assign(new Error(`remove mismatch in ${rel} at line ${cursor}`), { code: "CONTEXT_MISMATCH" });
        }
        while (cursor < found) {
          out.push(origLines[cursor - 1] ?? "");
          cursor++;
        }
        cursor++;
        removed++;
      } else {
        out.push(l.text);
        added++;
      }
    }
  }
  while (cursor <= origLines.length) {
    out.push(origLines[cursor - 1] ?? "");
    cursor++;
  }
  let content = out.join("\n");
  if (original.endsWith("\n") && !content.endsWith("\n")) content += "\n";
  return { content, added, removed };
}

export async function applyPatchLogic(ctx: ToolContext, input: ApplyPatchInput): Promise<ApplyPatchOutput> {
  const patch = input.patch ?? "";
  if (!patch.trim()) throw Object.assign(new Error("patch is required"), { code: "BAD_ARGS" });
  const dryRun = input.dryRun ?? false;
  const stripPrefix = input.stripPrefix ?? 1;
  const fuzzy = input.fuzzy ?? true;

  const filePatches = parsePatch(patch);
  const files: AppliedFile[] = [];
  const previews: string[] = [];

  for (const fp of filePatches) {
    const targetRaw = fp.newPath === "/dev/null" ? fp.oldPath : fp.newPath;
    const rel = strip(targetRaw, stripPrefix);
    if (!rel || rel === "/dev/null") throw Object.assign(new Error("invalid target path"), { code: "BAD_PATCH" });
    const r = resolveSafePath(ctx, rel);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${rel}`), { code: "PATH_TRAVERSAL" });

    let original = "";
    try {
      original = await fs.readFile(r.abs, "utf8");
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") throw e;
      original = "";
    }
    if (original.includes("\0")) throw Object.assign(new Error(`binary file: ${rel}`), { code: "BINARY" });

    const { content, added, removed } = applyHunks(original, fp.hunks, rel, fuzzy);
    files.push({ path: rel, abs: r.abs, hunks: fp.hunks.length, added, removed });
    previews.push(`--- ${rel} (${fp.hunks.length} hunks, +${added}/-${removed})`);

    if (!dryRun) {
      await fs.mkdir(path.dirname(r.abs), { recursive: true });
      const tmp = `${r.abs}.tmp-${process.pid}-${Date.now()}`;
      await fs.writeFile(tmp, content, "utf8");
      await fs.rename(tmp, r.abs);
    }
  }

  ctx.logger.info("apply_patch", { files: files.length, dryRun, fuzzy });
  return { files, preview: previews.join("\n"), dryRun };
}
