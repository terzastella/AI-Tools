import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";
import { scrubEnv } from "../../core/proc.js";

const execFileAsync = promisify(execFile);

export interface DiagnoseInput {
  paths?: string[];
  runTests?: boolean;
  testPattern?: string;
  timeoutMs?: number;
}

export interface DiagnoseIssue {
  source: "tsc" | "eslint" | "vitest";
  path?: string;
  line?: number;
  col?: number;
  message: string;
}

export interface DiagnoseOutput {
  issues: DiagnoseIssue[];
  summary: { tsc: number; eslint: number; vitest: number };
  ran: { tsc: boolean; eslint: boolean; vitest: boolean };
}

export const DIAGNOSE_VERSION = "1.0.0";

async function run(cmd: string, args: string[], cwd: string, timeout: number, env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { cwd, timeout, windowsHide: true, maxBuffer: 2_000_000, env });
    return { stdout: String(stdout), stderr: String(stderr), code: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: unknown; stderr?: unknown; code?: number };
    return { stdout: String(err.stdout ?? ""), stderr: String(err.stderr ?? ""), code: Number(err.code ?? 1) };
  }
}

function parseTsc(out: string, cwd: string): DiagnoseIssue[] {
  // tsc: src/a.ts(10,5): error TS2322: ...
  const issues: DiagnoseIssue[] = [];
  for (const line of out.split("\n")) {
    const m = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:\s+(.*)$/.exec(line.trim());
    if (!m) continue;
    let rel = m[1]!.replace(/\\/g, "/");
    // rendi relativo al cwd se assoluto
    if (/^[A-Za-z]:\//.test(rel) || rel.startsWith("/")) {
      try {
        rel = path.relative(cwd, path.resolve(cwd, rel)).replace(/\\/g, "/");
      } catch {
        /* tieni assoluto */
      }
    }
    issues.push({ source: "tsc", path: rel, line: Number(m[2]), col: Number(m[3]), message: m[5]!.slice(0, 300) });
    if (issues.length >= 200) break;
  }
  return issues;
}

function parseEslintJson(json: string): DiagnoseIssue[] {
  try {
    const arr = JSON.parse(json) as { filePath: string; messages: { line?: number; column?: number; message: string; severity: number }[] }[];
    const out: DiagnoseIssue[] = [];
    for (const f of arr) {
      for (const msg of f.messages) {
        const issue: DiagnoseIssue = { source: "eslint", message: msg.message.slice(0, 300) };
        if (msg.line !== undefined) issue.line = msg.line;
        if (msg.column !== undefined) issue.col = msg.column;
        // filePath assoluto -> tieni basename + dir tail
        issue.path = f.filePath.replace(/\\/g, "/").split("/").slice(-3).join("/");
        out.push(issue);
        if (out.length >= 200) return out;
      }
    }
    return out;
  } catch {
    return [];
  }
}

function parseVitest(out: string): DiagnoseIssue[] {
  // euristica: FAIL tests/x.test.ts > suite > test
  const issues: DiagnoseIssue[] = [];
  for (const line of out.split("\n")) {
    const m = /FAIL\s+([^\s]+\.test\.[tj]sx?)/.exec(line);
    if (m && m[1]) {
      const issue: DiagnoseIssue = { source: "vitest", path: m[1], message: line.trim().slice(0, 300) };
      issues.push(issue);
      if (issues.length >= 100) break;
    }
  }
  return issues;
}

export async function diagnoseLogic(ctx: ToolContext, input: DiagnoseInput): Promise<DiagnoseOutput> {
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["."];
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
  }
  const timeout = input.runTests ? (input.timeoutMs ?? 60000) : (input.timeoutMs ?? 30000);
  const runTests = input.runTests ?? false;

  // 1. tsc sempre (veloce) — usa il tsc del progetto, non quello della cartella temporanea
  // Motivo: i test girano in tmp/ senza node_modules, npx lì non trova typescript.
  const projectTsc = path.resolve(process.cwd(), "node_modules/typescript/bin/tsc");
  let tsc: { stdout: string; stderr: string; code: number };
  const env = scrubEnv(ctx);
  try {
    await fs.stat(projectTsc);
    tsc = await run("node", [projectTsc, "--noEmit", "--pretty", "false"], ctx.cwd, timeout, env);
  } catch {
    tsc = await run("npx", ["tsc", "--noEmit", "--pretty", "false"], ctx.cwd, timeout, env);
  }
  const tscIssues = parseTsc(tsc.stdout + "\n" + tsc.stderr, ctx.cwd);

  // 2. eslint se disponibile (best-effort, mai blocca)
  let eslintIssues: DiagnoseIssue[] = [];
  let ranEslint = false;
  const eslintCheck = await run("npx", ["--no-install", "eslint", "--version"], ctx.cwd, 8000, env);
  if (eslintCheck.code === 0) {
    ranEslint = true;
    const scope = rawPaths.join(" ");
    const res = await run("npx", ["eslint", ...rawPaths, "-f", "json"], ctx.cwd, timeout, env).catch(() => ({ stdout: "[]", stderr: "", code: 1 }));
    void scope;
    eslintIssues = parseEslintJson(res.stdout || "[]");
  }

  // 3. test solo se chiesto
  let vitestIssues: DiagnoseIssue[] = [];
  if (runTests) {
    const args = ["vitest", "run"];
    if (input.testPattern) args.push(input.testPattern);
    const res = await run("npx", args, ctx.cwd, timeout, env);
    vitestIssues = parseVitest(res.stdout + "\n" + res.stderr);
  }

  const issues = [...tscIssues, ...eslintIssues, ...vitestIssues].slice(0, 300);
  ctx.logger.info("diagnose", { tsc: tscIssues.length, eslint: eslintIssues.length, vitest: vitestIssues.length, runTests });
  return {
    issues,
    summary: { tsc: tscIssues.length, eslint: eslintIssues.length, vitest: vitestIssues.length },
    ran: { tsc: true, eslint: ranEslint, vitest: runTests },
  };
}
