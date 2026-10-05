import { spawn, type ChildProcess } from "node:child_process";
import { isDangerousCommand } from "../../core/policy.js";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface ShellSessionInput {
  action: "start" | "poll" | "kill" | "list";
  id?: string;
  cmd?: string;
  args?: string[];
  workdir?: string;
  tailChars?: number;
}

export interface SessionInfo {
  id: string;
  cmd: string;
  cwd: string;
  running: boolean;
  code: number | null;
  startedAt: string;
  outputChars: number;
}

export interface ShellSessionOutput {
  action: string;
  session?: SessionInfo;
  output?: string;
  truncated?: boolean;
  sessions?: SessionInfo[];
}

export const SHELL_SESSION_VERSION = "1.0.0";

const MAX_BUF = 200_000;
const MAX_SESSIONS = 20;
const SHELL_CHARS = /[;&|`$(){}!#~<>]/;

interface Session {
  id: string;
  cmd: string;
  cwd: string;
  child: ChildProcess;
  buf: string;
  running: boolean;
  code: number | null;
  startedAt: number;
}

const sessions = new Map<string, Session>();
let counter = 0;

function newId(): string {
  counter += 1;
  return `sh-${Date.now().toString(36)}-${counter}`;
}

function info(s: Session): SessionInfo {
  return {
    id: s.id,
    cmd: s.cmd,
    cwd: s.cwd,
    running: s.running,
    code: s.code,
    startedAt: new Date(s.startedAt).toISOString(),
    outputChars: s.buf.length,
  };
}

function append(s: Session, chunk: string): void {
  s.buf += chunk;
  if (s.buf.length > MAX_BUF) s.buf = s.buf.slice(s.buf.length - MAX_BUF);
}

function get(id: string): Session {
  const s = sessions.get(id);
  if (!s) throw Object.assign(new Error(`session not found: ${id}`), { code: "NOT_FOUND" });
  return s;
}

export async function shellSessionLogic(ctx: ToolContext, input: ShellSessionInput): Promise<ShellSessionOutput> {
  const action = input.action ?? "";
  if (action === "list") {
    return { action, sessions: [...sessions.values()].map(info) };
  }
  if (action === "poll") {
    const s = get((input.id ?? "").trim());
    const tail = input.tailChars ?? 4000;
    if (!Number.isInteger(tail) || tail < 100 || tail > 50_000) {
      throw Object.assign(new Error("tailChars must be 100..50000"), { code: "BAD_ARGS" });
    }
    const out = s.buf.slice(Math.max(0, s.buf.length - tail));
    return { action, session: info(s), output: out, truncated: s.buf.length > tail };
  }
  if (action === "kill") {
    const s = get((input.id ?? "").trim());
    try {
      s.child.kill();
    } catch {
      /* già morto */
    }
    s.running = false;
    if (s.code === null) s.code = -1;
    const snapshot = info(s);
    sessions.delete(s.id);
    ctx.logger.info("shell_session kill", { id: s.id });
    return { action, session: snapshot };
  }
  if (action === "start") {
    if (sessions.size >= MAX_SESSIONS) {
      throw Object.assign(new Error(`too many sessions (max ${MAX_SESSIONS}), kill one first`), { code: "TOO_MANY" });
    }
    const cmd = (input.cmd ?? "").trim();
    if (!cmd) throw Object.assign(new Error("cmd is required for start"), { code: "BAD_ARGS" });
    if (/\s/.test(cmd)) throw Object.assign(new Error("cmd must be a single binary, use args[] (no shell)"), { code: "BAD_ARGS" });
    if (SHELL_CHARS.test(cmd)) throw Object.assign(new Error("shell metachars not allowed in cmd"), { code: "BAD_ARGS" });
    const args = input.args ?? [];
    if (!Array.isArray(args) || args.length > 50) throw Object.assign(new Error("args must be an array max 50"), { code: "BAD_ARGS" });
    const full = [cmd, ...args].join(" ");
    if (isDangerousCommand(full)) throw Object.assign(new Error("dangerous command blocked"), { code: "POLICY_DENIED" });

    let cwd = ctx.cwd;
    if (input.workdir) {
      const r = resolveSafePath(ctx, input.workdir);
      if (!r.ok) throw Object.assign(new Error(`workdir escapes cwd: ${input.workdir}`), { code: "PATH_TRAVERSAL" });
      cwd = r.abs;
    }

    const id = newId();
    const child = spawn(cmd, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const s: Session = { id, cmd: full, cwd, child, buf: "", running: true, code: null, startedAt: Date.now() };
    child.stdout?.on("data", (d) => append(s, String(d)));
    child.stderr?.on("data", (d) => append(s, String(d)));
    child.on("error", (e) => {
      append(s, `\n[spawn error: ${e.message}]\n`);
      s.running = false;
      if (s.code === null) s.code = 1;
    });
    child.on("close", (code) => {
      s.running = false;
      s.code = code ?? 0;
    });
    sessions.set(id, s);
    ctx.logger.info("shell_session start", { id, cmd: full });
    return { action, session: info(s), output: "", truncated: false };
  }
  throw Object.assign(new Error(`unknown action: ${action} (start|poll|kill|list)`), { code: "BAD_ARGS" });
}
