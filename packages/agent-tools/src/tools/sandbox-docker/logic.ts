import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isDangerousCommand } from "../../core/policy.js";
import { scrubEnv } from "../../core/proc.js";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

const execFileAsync = promisify(execFile);

export interface SandboxDockerInput {
  image: string;
  cmd: string[];
  workdir?: string;
  timeoutMs?: number;
}

export interface SandboxDockerOutput {
  image: string;
  code: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
}

export const SANDBOX_DOCKER_VERSION = "1.0.0";

const IMAGE_RE = /^[a-z0-9][a-z0-9._/-]{0,200}(:[a-zA-Z0-9_.-]{1,50})?$/;

export async function sandboxDockerLogic(ctx: ToolContext, input: SandboxDockerInput): Promise<SandboxDockerOutput> {
  const image = (input.image ?? "").trim();
  if (!IMAGE_RE.test(image)) throw Object.assign(new Error("bad image name"), { code: "BAD_ARGS" });
  const cmd = input.cmd ?? [];
  if (!Array.isArray(cmd) || cmd.length === 0 || cmd.length > 20) {
    throw Object.assign(new Error("cmd must be an array 1..20"), { code: "BAD_ARGS" });
  }
  for (const c of cmd) {
    if (typeof c !== "string" || !c.trim() || c.length > 1000)
      throw Object.assign(new Error("bad cmd entry"), { code: "BAD_ARGS" });
  }
  const full = cmd.join(" ");
  if (isDangerousCommand(full)) throw Object.assign(new Error("dangerous command blocked"), { code: "POLICY_DENIED" });
  const timeoutMs = input.timeoutMs ?? 60_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10_000 || timeoutMs > 300_000) {
    throw Object.assign(new Error("timeoutMs must be 10000..300000"), { code: "BAD_ARGS" });
  }
  let mount = ctx.cwd;
  if (input.workdir && input.workdir !== ".") {
    const r = resolveSafePath(ctx, input.workdir);
    if (!r.ok) throw Object.assign(new Error(`workdir escapes cwd: ${input.workdir}`), { code: "PATH_TRAVERSAL" });
    mount = r.abs;
  }

  // docker presente? (DOCKER_HOST via ctx.envAllow se daemon remoto)
  try {
    await execFileAsync("docker", ["info"], { timeout: 10_000, windowsHide: true, env: scrubEnv(ctx) });
  } catch {
    throw Object.assign(new Error("docker not available (daemon spento o non installato)"), { code: "DOCKER_MISSING" });
  }

  ctx.logger.info("sandbox_docker", { image });
  try {
    const { stdout, stderr } = await execFileAsync(
      "docker",
      [
        "run",
        "--rm",
        "--network",
        "none",
        "--memory",
        "512m",
        "--cpus",
        "1",
        "-v",
        `${mount}:/work`,
        "-w",
        "/work",
        image,
        ...cmd,
      ],
      { cwd: ctx.cwd, timeout: timeoutMs, windowsHide: true, maxBuffer: 4_000_000, env: scrubEnv(ctx) },
    );
    const out = String(stdout);
    const err = String(stderr);
    return {
      image,
      code: 0,
      stdout: out.slice(0, 20_000),
      stderr: err.slice(0, 5_000),
      truncated: out.length > 20_000,
    };
  } catch (e: unknown) {
    const err = e as { stdout?: unknown; stderr?: unknown; code?: number; killed?: boolean; message?: string };
    if (err.killed) throw Object.assign(new Error(`timeout after ${timeoutMs}ms`), { code: "TIMEOUT" });
    const out = String(err.stdout ?? "");
    const errText = String(err.stderr ?? err.message ?? "");
    if (/Unable to find image|pull access denied|not found/i.test(errText)) {
      throw Object.assign(new Error(`image non disponibile: ${image}`), { code: "IMAGE_MISSING" });
    }
    return {
      image,
      code: Number(err.code ?? 1),
      stdout: out.slice(0, 20_000),
      stderr: errText.slice(0, 5_000),
      truncated: out.length > 20_000,
    };
  }
}
