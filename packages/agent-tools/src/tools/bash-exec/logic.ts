import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isDangerousCommand } from "../../core/policy.js";
import { scrubEnv } from "../../core/proc.js";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

const execFileAsync = promisify(execFile);

export interface BashExecInput {
  cmd: string;
  args?: string[];
  workdir?: string;
  timeoutMs?: number;
}

export interface BashExecOutput {
  cmd: string;
  args: string[];
  cwd: string;
  code: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
}

export const BASH_EXEC_VERSION = "1.0.0";

const MAX_OUT = 20_000;
const SHELL_CHARS = /[;&|`$(){}!#~<>]/;

function trunc(s: string): { text: string; cut: boolean } {
  if (s.length <= MAX_OUT) return { text: s, cut: false };
  return { text: s.slice(0, MAX_OUT), cut: true };
}

export async function bashExecLogic(ctx: ToolContext, input: BashExecInput): Promise<BashExecOutput> {
  const cmd = (input.cmd ?? "").trim();
  if (!cmd) throw Object.assign(new Error("cmd is required"), { code: "BAD_ARGS" });
  if (/\s/.test(cmd)) throw Object.assign(new Error("cmd must be a single binary, use args[] for params (no shell)"), { code: "BAD_ARGS" });
  if (SHELL_CHARS.test(cmd)) throw Object.assign(new Error("shell metachars not allowed in cmd"), { code: "BAD_ARGS" });

  const args = input.args ?? [];
  if (!Array.isArray(args) || args.length > 50) throw Object.assign(new Error("args must be an array max 50"), { code: "BAD_ARGS" });
  for (const a of args) {
    if (typeof a !== "string" || a.length > 2000) throw Object.assign(new Error("bad arg"), { code: "BAD_ARGS" });
  }

  const full = [cmd, ...args].join(" ");
  if (isDangerousCommand(full)) throw Object.assign(new Error("dangerous command blocked"), { code: "POLICY_DENIED" });

  const timeoutMs = input.timeoutMs ?? 30_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 5000 || timeoutMs > 120_000) {
    throw Object.assign(new Error("timeoutMs must be 5000..120000"), { code: "BAD_ARGS" });
  }

  let cwd = ctx.cwd;
  if (input.workdir) {
    const r = resolveSafePath(ctx, input.workdir);
    if (!r.ok) throw Object.assign(new Error(`workdir escapes cwd: ${input.workdir}`), { code: "PATH_TRAVERSAL" });
    cwd = r.abs;
  }

  ctx.logger.info("bash_exec", { cmd, args: args.length, cwd });
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { cwd, timeout: timeoutMs, windowsHide: true, maxBuffer: 2_000_000, env: scrubEnv(ctx) });
    const o = trunc(String(stdout ?? ""));
    const e = trunc(String(stderr ?? ""));
    return { cmd, args, cwd, code: 0, stdout: o.text, stderr: e.text, truncated: o.cut || e.cut };
  } catch (e: unknown) {
    const err = e as { stdout?: unknown; stderr?: unknown; code?: number; killed?: boolean; message?: string };
    if (err.killed) throw Object.assign(new Error(`timeout after ${timeoutMs}ms`), { code: "TIMEOUT" });
    const o = trunc(String(err.stdout ?? ""));
    const errText = trunc(String(err.stderr ?? err.message ?? ""));
    return { cmd, args, cwd, code: Number(err.code ?? 1), stdout: o.text, stderr: errText.text, truncated: o.cut || errText.cut };
  }
}
