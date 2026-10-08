import { promises as fs } from "node:fs";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface EditManyItem {
  path: string;
  oldString: string;
  newString: string;
  replaceAll?: boolean;
}

export interface EditManyInput {
  edits: EditManyItem[];
  dryRun?: boolean;
}

export interface EditManyApplied {
  path: string;
  abs: string;
  replacements: number;
}

export interface EditManyOutput {
  applied: EditManyApplied[];
  dryRun: boolean;
  preview: string;
}

export const EDIT_MANY_VERSION = "1.0.0";

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

export async function editManyLogic(ctx: ToolContext, input: EditManyInput): Promise<EditManyOutput> {
  const edits = input.edits ?? [];
  if (!Array.isArray(edits) || edits.length === 0 || edits.length > 20) {
    throw Object.assign(new Error("edits must be 1..20 items"), { code: "BAD_ARGS" });
  }
  const dryRun = input.dryRun ?? false;

  // Fase 1: verifica tutti i path
  const absList: string[] = [];
  for (const e of edits) {
    const rel = (e.path ?? "").trim();
    if (!rel) throw Object.assign(new Error("path is required"), { code: "BAD_ARGS" });
    if (!e.oldString) throw Object.assign(new Error(`oldString required for ${rel}`), { code: "BAD_ARGS" });
    if (e.oldString === e.newString) throw Object.assign(new Error(`noop edit for ${rel}`), { code: "NOOP" });
    const r = resolveSafePath(ctx, rel);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${rel}`), { code: "PATH_TRAVERSAL" });
    absList.push(r.abs);
  }

  // Fase 2: leggi tutto, verifica match senza scrivere
  const befores: string[] = [];
  const afters: string[] = [];
  const counts: number[] = [];
  for (let i = 0; i < edits.length; i++) {
    const item = edits[i]!;
    const abs = absList[i]!;
    let before: string;
    try {
      before = await fs.readFile(abs, "utf8");
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw Object.assign(new Error(`file not found: ${item.path}`), { code: "NOT_FOUND" });
      }
      throw e;
    }
    const occurrences = countOccurrences(before, item.oldString);
    if (occurrences === 0)
      throw Object.assign(new Error(`oldString not found in ${item.path}`), { code: "CONTEXT_MISMATCH" });
    const replaceAll = item.replaceAll ?? false;
    if (occurrences > 1 && !replaceAll) {
      throw Object.assign(new Error(`oldString matches ${occurrences} times in ${item.path} (use replaceAll:true)`), {
        code: "AMBIGUOUS",
      });
    }
    const after = replaceAll
      ? before.split(item.oldString).join(item.newString)
      : before.replace(item.oldString, item.newString);
    befores.push(before);
    afters.push(after);
    counts.push(replaceAll ? occurrences : 1);
  }

  const previewLines: string[] = [];
  for (let i = 0; i < edits.length; i++) {
    previewLines.push(`${edits[i]!.path}: ${counts[i]} replacement(s)`);
  }
  const preview = previewLines.join("\n").slice(0, 2000);

  if (dryRun) {
    return {
      applied: edits.map((e, i) => ({ path: e.path, abs: absList[i]!, replacements: counts[i]! })),
      dryRun: true,
      preview,
    };
  }

  // Fase 3: scrivi tutto (atomico per file)
  for (let i = 0; i < edits.length; i++) {
    const abs = absList[i]!;
    const tmp = `${abs}.tmp-${process.pid}-${Date.now()}-${i}`;
    await fs.writeFile(tmp, afters[i]!, "utf8");
    await fs.rename(tmp, abs);
  }

  ctx.logger.info("edit_many", { edits: edits.length });
  return {
    applied: edits.map((e, i) => ({ path: e.path, abs: absList[i]!, replacements: counts[i]! })),
    dryRun: false,
    preview,
  };
}
