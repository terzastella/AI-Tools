/**
 * ToolContext + safe path resolution.
 * Tutti i tool filesystem DEVONO risolvere i path qui dentro
 * per bloccare traversal fuori cwd.
 */
import path from "node:path";
import { realpathSync } from "node:fs";
import type { Approver } from "./approval.js";

export interface Logger {
  debug(msg: string, extra?: Record<string, unknown>): void;
  info(msg: string, extra?: Record<string, unknown>): void;
  warn(msg: string, extra?: Record<string, unknown>): void;
  error(msg: string, extra?: Record<string, unknown>): void;
}

export const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export interface ToolContext {
  cwd: string;
  logger: Logger;
  /** Se true, i tool con supporto dryRun lo forzano. Opzionale, retrocompatibile. */
  dryRunGlobal?: boolean;
  /**
   * Se presente, viene chiamato per ogni azione write/execute.
   * Deve rispondere "accept" o "deny". Se assente, vale solo la policy
   * (comportamento vecchio, utile per i test).
   */
  approver?: Approver;
  /**
   * Se true, i tool web possono contattare anche loopback/reti private.
   * Default false (blocca SSRF verso 127.x, 10.x, 192.168.x, metadata cloud).
   * Serve true solo nei test con server locale.
   */
  allowPrivateNet?: boolean;
  /**
   * Tetto token stimati per sessione (args+result di ogni tool).
   * Se superato, i tool tornano BUDGET_EXCEEDED. Opzionale, default nessun tetto.
   */
  budgetLimit?: number;
  /** Id sessione agente: finisce in audit per raggruppare le call. Opzionale. */
  sessionId?: string;
  /**
   * Nomi di env extra permessi ai processi figli (oltre la allowlist minima).
   * I secret passano solo da qui o da config esplicite, mai da ereditarietà cieca.
   */
  envAllow?: string[];
}

export function createContext(cwd: string = process.cwd(), logger: Logger = noopLogger): ToolContext {
  return { cwd: path.resolve(cwd), logger };
}

/** Risolve gli antenati esistenti via realpath e riattacca il resto: smaschera i symlink. */
function realBase(abs: string): string {
  let cur = abs;
  const rest: string[] = [];
  for (;;) {
    try {
      return path.join(realpathSync(cur), ...rest.reverse());
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return abs;
      rest.push(path.basename(cur));
      cur = parent;
    }
  }
}

/**
 * Risolve target contro ctx.cwd e rifiuta escape (../, assoluti fuori cwd, drive diversi su win).
 * Risolve anche i symlink (realpath): un link dentro cwd che punta fuori viene rifiutato.
 * Nota: resta una race TOCTOU microscopica tra check e uso, come in ogni sandbox path-based.
 */
export function resolveSafePath(
  ctx: ToolContext,
  target: string,
): { ok: true; abs: string } | { ok: false; attempted: string } {
  let cwdReal: string;
  try {
    cwdReal = realpathSync(path.resolve(ctx.cwd));
  } catch {
    cwdReal = path.resolve(ctx.cwd);
  }
  const abs = path.resolve(cwdReal, target);
  const realAbs = realBase(abs);
  const rel = path.relative(cwdReal, realAbs);
  // rel === '' => stesso cwd, ok. Altrimenti non deve iniziare con .. né essere assoluto.
  if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
    return { ok: true, abs: realAbs };
  }
  return { ok: false, attempted: realAbs };
}
