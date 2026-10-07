import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveSafePath, type ToolContext } from "../../core/context.js";
import { scrubEnv } from "../../core/proc.js";

const execFileAsync = promisify(execFile);

export interface TestRunnerInput {
  runner: "vitest" | "pytest" | "npm";
  pattern?: string;
  workdir?: string;
  timeoutMs?: number;
}

export interface TestRunnerOutput {
  runner: string;
  code: number;
  passed: number;
  failed: number;
  summary: string;
  stdout: string;
  stderr: string;
}

export const TEST_RUNNER_VERSION = "1.0.0";

function parseCounts(runner: string, out: string): { passed: number; failed: number; summary: string } {
  let passed = 0;
  let failed = 0;
  // vitest: "Tests  142 passed" / "3 failed"
  const mV = /Tests\s+(?:(\d+)\s+failed\s*\|?\s*)?(?:(\d+)\s+passed)?/.exec(out);
  if (runner === "vitest" && mV) {
    failed = Number(mV[1] ?? 0);
    passed = Number(mV[2] ?? 0);
  }
  // pytest: "5 passed, 2 failed" / "1 failed, 5 passed"
  const mP = /(\d+)\s+passed/.exec(out);
  const mF = /(\d+)\s+failed/.exec(out);
  if (runner === "pytest" || runner === "npm") {
    if (mP) passed = Number(mP[1]);
    if (mF) failed = Number(mF[1]);
  }
  const summary = failed === 0 && passed === 0 ? "unknown (parse manuale stdout)" : `${passed} passed, ${failed} failed`;
  return { passed, failed, summary };
}

export async function testRunnerLogic(ctx: ToolContext, input: TestRunnerInput): Promise<TestRunnerOutput> {
  const runner = input.runner ?? "";
  if (runner !== "vitest" && runner !== "pytest" && runner !== "npm") {
    throw Object.assign(new Error("runner must be vitest|pytest|npm"), { code: "BAD_ARGS" });
  }
  const pattern = (input.pattern ?? "").trim();
  if (pattern.length > 300 || /[;&|`$(){}!#~<>]/.test(pattern)) {
    throw Object.assign(new Error("bad pattern (no shell chars, max 300)"), { code: "BAD_ARGS" });
  }
  const timeoutMs = input.timeoutMs ?? 120_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10_000 || timeoutMs > 300_000) {
    throw Object.assign(new Error("timeoutMs must be 10000..300000"), { code: "BAD_ARGS" });
  }
  let cwd = ctx.cwd;
  if (input.workdir) {
    const r = resolveSafePath(ctx, input.workdir);
    if (!r.ok) throw Object.assign(new Error(`workdir escapes cwd: ${input.workdir}`), { code: "PATH_TRAVERSAL" });
    cwd = r.abs;
  }

  let cmd: string;
  let args: string[];
  if (runner === "vitest") {
    cmd = "npx";
    args = ["vitest", "run", ...(pattern ? [pattern] : [])];
  } else if (runner === "pytest") {
    cmd = "python";
    args = ["-m", "pytest", "-q", ...(pattern ? [pattern] : [])];
  } else {
    cmd = "npm";
    args = ["test", ...(pattern ? ["--", pattern] : [])];
  }

  ctx.logger.info("test_runner", { runner, pattern });
  let stdout = "";
  let stderr = "";
  let code = 0;
  try {
    const r = await execFileAsync(cmd, args, { cwd, timeout: timeoutMs, windowsHide: true, maxBuffer: 4_000_000, env: scrubEnv(ctx) });
    stdout = String(r.stdout ?? "");
    stderr = String(r.stderr ?? "");
  } catch (e: unknown) {
    const err = e as { stdout?: unknown; stderr?: unknown; code?: number | string; killed?: boolean; message?: string };
    if (err.killed) throw Object.assign(new Error(`timeout after ${timeoutMs}ms`), { code: "TIMEOUT" });
    if (err.code === "ENOENT" || /spawn .* ENOENT/.test(err.message ?? "")) {
      throw Object.assign(new Error(`${cmd} not available here`), { code: "TOOL_MISSING" });
    }
    stdout = String(err.stdout ?? "");
    stderr = String(err.stderr ?? "");
    code = Number(err.code ?? 1);
  }
  const counts = parseCounts(runner, `${stdout}\n${stderr}`);
  return { runner, code, passed: counts.passed, failed: counts.failed, summary: counts.summary, stdout: stdout.slice(-20_000), stderr: stderr.slice(-5_000) };
}
