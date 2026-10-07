import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { resolveSafePath, type ToolContext } from "../../core/context.js";
import { scrubEnv } from "../../core/proc.js";

const execFileAsync = promisify(execFile);

export interface GitWriteInput {
  op: "add" | "commit" | "branch" | "checkout" | "stash";
  files?: string[];
  msg?: string;
  branch?: string;
  create?: boolean;
  timeoutMs?: number;
}

export interface GitWriteOutput {
  op: string;
  stdout: string;
  stderr: string;
  code: number;
}

export const GIT_WRITE_VERSION = "1.0.0";

const BRANCH_RE = /^[A-Za-z0-9._/-]{1,100}$/;

async function runGit(cwd: string, args: string[], timeout: number, env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, { cwd, timeout, windowsHide: true, maxBuffer: 2_000_000, env });
    return { stdout: String(stdout), stderr: String(stderr), code: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: unknown; stderr?: unknown; code?: number; killed?: boolean };
    if (err.killed) throw Object.assign(new Error(`git timeout`), { code: "TIMEOUT" });
    return { stdout: String(err.stdout ?? ""), stderr: String(err.stderr ?? ""), code: Number(err.code ?? 1) };
  }
}

export async function gitWriteLogic(ctx: ToolContext, input: GitWriteInput): Promise<GitWriteOutput> {
  const op = input.op ?? "";
  const timeoutMs = input.timeoutMs ?? 30_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 5000 || timeoutMs > 120_000) {
    throw Object.assign(new Error("timeoutMs must be 5000..120000"), { code: "BAD_ARGS" });
  }
  // push/fetch/pull mai da qui: solo locale, il push lo fai tu dall'App
  if ((op as string) === "push" || (op as string) === "fetch" || (op as string) === "pull") {
    throw Object.assign(new Error(`${op} is blocked: usa la tua GitHub App per rete`), { code: "POLICY_DENIED" });
  }

  // deve essere un repo git
  try {
    await fs.stat(path.join(ctx.cwd, ".git"));
  } catch {
    throw Object.assign(new Error("not a git repo (manca .git in cwd)"), { code: "NOT_A_REPO" });
  }

  // risolvi file dentro cwd
  const files = (input.files ?? []).map((f) => {
    if (typeof f !== "string" || !f.trim()) throw Object.assign(new Error("bad file entry"), { code: "BAD_ARGS" });
    const r = resolveSafePath(ctx, f.trim());
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${f}`), { code: "PATH_TRAVERSAL" });
    return path.relative(ctx.cwd, r.abs).replace(/\\/g, "/") || ".";
  });
  if (files.length > 50) throw Object.assign(new Error("files max 50"), { code: "BAD_ARGS" });

  let args: string[];
  if (op === "add") {
    if (files.length === 0) throw Object.assign(new Error("add needs files[]"), { code: "BAD_ARGS" });
    args = ["add", "--", ...files];
  } else if (op === "commit") {
    const msg = (input.msg ?? "").trim();
    if (!msg || msg.length > 500) throw Object.assign(new Error("commit needs msg 1..500 chars"), { code: "BAD_ARGS" });
    args = files.length > 0 ? ["commit", "-m", msg, "--", ...files] : ["commit", "-m", msg];
  } else if (op === "branch") {
    const b = (input.branch ?? "").trim();
    if (!BRANCH_RE.test(b)) throw Object.assign(new Error("bad branch name"), { code: "BAD_ARGS" });
    args = ["branch", b];
  } else if (op === "checkout") {
    const b = (input.branch ?? "").trim();
    if (!BRANCH_RE.test(b)) throw Object.assign(new Error("bad branch name"), { code: "BAD_ARGS" });
    args = input.create ? ["checkout", "-b", b] : ["checkout", b];
  } else if (op === "stash") {
    const msg = (input.msg ?? "").trim();
    args = msg ? ["stash", "push", "-m", msg] : ["stash", "push"];
  } else {
    throw Object.assign(new Error(`unknown op: ${op} (add|commit|branch|checkout|stash)`), { code: "BAD_ARGS" });
  }

  ctx.logger.info("git_write", { op });
  const r = await runGit(ctx.cwd, args, timeoutMs, scrubEnv(ctx));
  return { op, stdout: r.stdout.slice(0, 20_000), stderr: r.stderr.slice(0, 20_000), code: r.code };
}
