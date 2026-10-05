/**
 * ToolContext + safe path resolution.
 * Tutti i tool filesystem DEVONO risolvere i path qui dentro
 * per bloccare traversal fuori cwd.
 */
import path from "node:path";
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
}

export function createContext(cwd: string = process.cwd(), logger: Logger = noopLogger): ToolContext {
  return { cwd: path.resolve(cwd), logger };
}

/** Risolve target contro ctx.cwd e rifiuta escape (../, assoluti fuori cwd, drive diversi su win). */
export function resolveSafePath(ctx: ToolContext, target: string): { ok: true; abs: string } | { ok: false; attempted: string } {
  const cwdResolved = path.resolve(ctx.cwd);
  const abs = path.resolve(cwdResolved, target);
  const rel = path.relative(cwdResolved, abs);
  // rel === '' => stesso cwd, ok. Altrimenti non deve iniziare con .. né essere assoluto.
  if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
    return { ok: true, abs };
  }
  return { ok: false, attempted: abs };
}
