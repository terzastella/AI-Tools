import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { scrubEnv } from "../../core/proc.js";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

const execFileAsync = promisify(execFile);

export type GitAction = "status" | "diff" | "log" | "branch" | "blame" | "staged";

export interface GitInput {
  action?: GitAction;
  path?: string;
  maxLines?: number;
  line?: number;
}

export interface GitOutput {
  action: GitAction;
  output: string;
  truncated: boolean;
}

export const GIT_VERSION = "1.0.0";

async function runGit(
  args: string[],
  cwd: string,
  timeout: number,
  env: NodeJS.ProcessEnv,
): Promise<{ out: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      timeout,
      windowsHide: true,
      maxBuffer: 2_000_000,
      env,
    });
    return { out: String(stdout || stderr), code: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: unknown; stderr?: unknown; message?: string };
    const out = String(err.stdout ?? err.stderr ?? err.message ?? "git failed");
    return { out: out.slice(0, 20000), code: 1 };
  }
}

export async function gitLogic(ctx: ToolContext, input: GitInput): Promise<GitOutput> {
  const action = input.action ?? "status";
  if (!["status", "diff", "log", "branch", "blame", "staged"].includes(action))
    throw Object.assign(new Error("action must be status|diff|log|branch|blame|staged"), { code: "BAD_ARGS" });
  const rel = (input.path ?? ".").trim() || ".";
  const maxLines = input.maxLines ?? 200;
  if (!Number.isInteger(maxLines) || maxLines < 1 || maxLines > 1000) {
    throw Object.assign(new Error("maxLines must be 1..1000"), { code: "BAD_ARGS" });
  }
  const r = resolveSafePath(ctx, rel);
  if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${rel}`), { code: "PATH_TRAVERSAL" });

  const args =
    action === "status"
      ? ["status", "--short", "--branch"]
      : action === "diff"
        ? ["diff", "--", "."]
        : action === "log"
          ? ["log", "--oneline", "-20"]
          : action === "branch"
            ? ["branch", "--show-current"]
            : action === "staged"
              ? ["diff", "--cached", "--stat"]
              : (() => {
                  const line = input.line ?? 0;
                  if (!Number.isInteger(line) || line < 1)
                    throw Object.assign(new Error("line must be >= 1 for blame"), { code: "BAD_ARGS" });
                  return ["blame", "-L", `${line},${line}`, "--", rel];
                })();
  const { out, code } = await runGit(args, r.abs, 15000, scrubEnv(ctx));
  if (code !== 0 && out.toLowerCase().includes("not a git repository")) {
    throw Object.assign(new Error("not a git repository"), { code: "NOT_GIT" });
  }
  const lines = out.split("\n");
  const truncated = lines.length > maxLines;
  const output = lines.slice(0, maxLines).join("\n").slice(0, 20000);

  ctx.logger.info("git", { action, truncated });
  return { action, output, truncated };
}
