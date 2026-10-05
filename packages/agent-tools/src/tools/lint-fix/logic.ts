import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

const execFileAsync = promisify(execFile);

export interface LintFixInput {
  paths: string[];
  timeoutMs?: number;
}

export interface LintFixOutput {
  paths: string[];
  stdout: string;
  stderr: string;
  code: number;
}

export const LINT_FIX_VERSION = "1.0.0";

export async function lintFixLogic(ctx: ToolContext, input: LintFixInput): Promise<LintFixOutput> {
  const paths = input.paths ?? [];
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 20) {
    throw Object.assign(new Error("paths must be an array 1..20"), { code: "BAD_ARGS" });
  }
  const rels = paths.map((p) => {
    if (typeof p !== "string" || !p.trim()) throw Object.assign(new Error("bad path entry"), { code: "BAD_ARGS" });
    const r = resolveSafePath(ctx, p.trim());
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
    if (!/\.(ts|js|tsx|jsx|mts|cts)$/.test(r.abs)) throw Object.assign(new Error(`only JS/TS files: ${p}`), { code: "BAD_ARGS" });
    return p.trim().replace(/\\/g, "/");
  });
  const timeoutMs = input.timeoutMs ?? 60_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10_000 || timeoutMs > 180_000) {
    throw Object.assign(new Error("timeoutMs must be 10000..180000"), { code: "BAD_ARGS" });
  }

  ctx.logger.info("lint_fix", { paths: rels.length });
  try {
    const { stdout, stderr } = await execFileAsync("npx", ["eslint", "--fix", "--", ...rels], {
      cwd: ctx.cwd,
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 2_000_000,
    });
    return { paths: rels, stdout: String(stdout).slice(0, 10_000), stderr: String(stderr).slice(0, 5_000), code: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: unknown; stderr?: unknown; code?: number; killed?: boolean; message?: string };
    if (err.killed) throw Object.assign(new Error(`timeout after ${timeoutMs}ms`), { code: "TIMEOUT" });
    const msg = String(err.stderr ?? err.message ?? "");
    if (/could not determine executable|not found|Cannot find/i.test(msg)) {
      throw Object.assign(new Error("eslint not installed in this project"), { code: "ESLINT_MISSING" });
    }
    return { paths: rels, stdout: String(err.stdout ?? "").slice(0, 10_000), stderr: msg.slice(0, 5_000), code: Number(err.code ?? 1) };
  }
}
