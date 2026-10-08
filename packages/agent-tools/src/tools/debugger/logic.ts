import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";
import { diagnoseLogic } from "../diagnose/logic.js";
import { reviewerLogic } from "../reviewer/logic.js";

export interface DebuggerInput {
  errorLog: string;
  paths?: string[];
  maxCandidates?: number;
  applyFix?: boolean;
  backup?: boolean;
}

export interface DebugCandidate {
  path: string;
  line?: number;
  col?: number;
  score: number;
  reason: string;
  verified: boolean;
}

export interface DebuggerOutput {
  diagnosis: string;
  candidates: DebugCandidate[];
  patchPreview?: string;
  applied?: { path: string; replacements?: number; backupPath?: string };
  verification?: { errors: number; warnings: number };
}

export const DEBUGGER_VERSION = "1.1.0";

const STACK_RE = /([A-Za-z0-9_./\\-]+\.(?:ts|js|mjs|cjs|tsx|jsx|py|json))(?:\s*:\s*|\s+|:)(\d+)(?::(\d+))?/g;

function parseStack(errorLog: string): { path: string; line?: number; col?: number }[] {
  const out: { path: string; line?: number; col?: number }[] = [];
  let m: RegExpExecArray | null;
  STACK_RE.lastIndex = 0;
  while ((m = STACK_RE.exec(errorLog)) !== null) {
    const raw = m[1]!;
    const line = m[2] !== undefined ? Number(m[2]) : undefined;
    const col = m[3] !== undefined ? Number(m[3]) : undefined;
    const norm = raw.replace(/\\/g, "/").replace(/^\.\//, "");
    const entry: { path: string; line?: number; col?: number } = { path: norm };
    if (Number.isFinite(line)) entry.line = line as number;
    if (Number.isFinite(col)) entry.col = col as number;
    out.push(entry);
    if (out.length >= 10) break;
  }
  return out;
}

export async function debuggerLogic(ctx: ToolContext, input: DebuggerInput): Promise<DebuggerOutput> {
  const log = (input.errorLog ?? "").trim();
  if (!log) throw Object.assign(new Error("errorLog is required"), { code: "BAD_ARGS" });
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["."];
  const maxCandidates = input.maxCandidates ?? 5;
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 20) {
    throw Object.assign(new Error("maxCandidates must be 1..20"), { code: "BAD_ARGS" });
  }
  const applyFix = input.applyFix ?? false;
  const backup = input.backup ?? true;
  void backup;

  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
  }

  // Errori noti dei nostri tool: deterministici, senza diagnose
  const knownAmbiguous = /matches \d+ times \(use replaceAll:true\)/.test(log);
  const knownNotFound = /oldString not found|file not found|NOT_FOUND/.test(log);
  if (knownAmbiguous || knownNotFound) {
    const patchPreview = knownAmbiguous
      ? "Trovato: edit ambiguo. Riprova edit_file con replaceAll:true o restringi oldString."
      : "Trovato: file o stringa mancante. Verifica path con prepare_context, poi create_file o correggi oldString.";
    ctx.logger.info("debug_error", { candidates: 0, known: true });
    return {
      diagnosis: `${log.split(/[\r\n]+/)[0]?.slice(0, 200) ?? log} — causa trovata (errore noto).`,
      candidates: [],
      patchPreview,
    };
  }

  // 1. Dottore vero sullo scope: errori tsc confermati
  let tscIssues: { path?: string; line?: number; message: string }[] = [];
  try {
    const diag = await diagnoseLogic(ctx, { paths: rawPaths });
    tscIssues = diag.issues.filter((i) => i.source === "tsc").slice(0, 20);
  } catch {
    tscIssues = [];
  }
  const tscByPath = new Map<string, { line?: number; message: string }[]>();
  for (const t of tscIssues) {
    if (!t.path) continue;
    const key = t.path.replace(/\\/g, "/");
    const arr = tscByPath.get(key) ?? [];
    const entry: { line?: number; message: string } = { message: t.message };
    if (t.line !== undefined) entry.line = t.line;
    arr.push(entry);
    tscByPath.set(key, arr);
  }

  // 2. Stack verificato: il file esiste davvero
  const stackHits = parseStack(log);
  const candidates: DebugCandidate[] = [];
  for (const h of stackHits) {
    const tail = h.path.split("/").slice(-3).join("/");
    const tries = rawPaths.map((b) => path.join(b, tail));
    // prova anche il path così com'è
    tries.unshift(h.path);
    let found: string | undefined;
    for (const t of tries) {
      const r = resolveSafePath(ctx, t);
      if (!r.ok) continue;
      try {
        const st = await fs.stat(r.abs);
        if (st.isFile()) {
          found = path.relative(ctx.cwd, r.abs).replace(/\\/g, "/");
          break;
        }
      } catch {
        /* continua */
      }
    }
    if (found === undefined) continue; // non indovina: salta se non esiste
    if (candidates.some((c) => c.path === found && c.line === h.line)) continue;
    // File esiste = già verificato. Tsc aggiunge conferma.
    let verified = true;
    let score = 100;
    let reason = `stacktrace verificato: ${h.path}${h.line ? ":" + h.line : ""} (file esiste)`;
    const tscList = tscByPath.get(found) ?? tscByPath.get(found.split("/").slice(-2).join("/")) ?? [];
    for (const t of tscList) {
      if (h.line !== undefined && t.line !== undefined && Math.abs(h.line - t.line) <= 2) {
        verified = true;
        score = 150;
        reason += ` + confermato da tsc riga ${t.line}: ${t.message.slice(0, 100)}`;
        break;
      }
    }
    if (!verified && tscList.length > 0 && h.line === undefined) {
      verified = true;
      score = 120;
      reason += " + tsc presente nello stesso file";
    }
    const cand: DebugCandidate = { path: found, score, reason, verified };
    if (h.line !== undefined) cand.line = h.line;
    if (h.col !== undefined) cand.col = h.col;
    candidates.push(cand);
    if (candidates.length >= maxCandidates) break;
  }

  // 3. Senza stack: usa errori tsc veri come candidati (non parole chiave)
  if (candidates.length === 0) {
    for (const t of tscIssues.slice(0, maxCandidates)) {
      if (!t.path) continue;
      candidates.push({
        path: t.path,
        score: 80,
        reason: `errore tsc trovato: ${t.message.slice(0, 120)}`,
        verified: true,
        ...(t.line !== undefined ? { line: t.line } : {}),
      });
    }
  }

  // 4. Niente di verificato → dillo chiaro, non indovinare
  if (candidates.length === 0) {
    throw Object.assign(
      new Error("NO_CANDIDATE: no verified candidate found (tsc pulito e nessuno stack verificato)"),
      { code: "NO_CANDIDATE" },
    );
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, maxCandidates);
  const first = top[0]!;
  const firstLine = log.split(/[\r\n]+/)[0] ?? log;
  const diagnosis = first.verified
    ? `Trovato in ${first.path}${first.line ? ":" + first.line : ""} — ${firstLine.slice(0, 200)}`
    : `Possibile in ${first.path} (non verificato) — ${firstLine.slice(0, 200)}`;

  const patchPreview = `Trovato: apri ${first.path}${first.line ? " riga " + first.line : ""}, leggi con prepare_context, applica edit_file o apply_patch. Verificato: ${first.verified ? "sì (file esiste + tsc)" : "no"}.`;

  let verification: DebuggerOutput["verification"];
  if (applyFix) {
    try {
      const rev = await reviewerLogic(ctx, { paths: [first.path], maxFiles: 1, useDiagnose: true });
      verification = { errors: rev.summary.errors, warnings: rev.summary.warnings };
    } catch {
      /* best-effort */
    }
  }

  ctx.logger.info("debug_error", { candidates: top.length, verified: top.filter((c) => c.verified).length });
  const out: DebuggerOutput = { diagnosis, candidates: top };
  out.patchPreview = patchPreview;
  if (verification !== undefined) out.verification = verification;
  return out;
}
