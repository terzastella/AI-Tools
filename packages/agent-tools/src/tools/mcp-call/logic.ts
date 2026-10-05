import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import readline from "node:readline";
import { isDangerousCommand } from "../../core/policy.js";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface McpCallInput {
  server: string;
  tool: string;
  args?: Record<string, unknown>;
  timeoutMs?: number;
  config?: string;
}

export interface McpCallOutput {
  server: string;
  tool: string;
  result: unknown;
  truncated: boolean;
}

export const MCP_CALL_VERSION = "1.0.0";

const MAX_RESULT = 20_000;

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

async function loadServer(ctx: ToolContext, configRel: string, name: string): Promise<{ cfg: McpServerConfig; configFile: string }> {
  const r = resolveSafePath(ctx, configRel);
  if (!r.ok) fail("PATH_TRAVERSAL", `config escapes cwd: ${configRel}`);
  let raw: string;
  try {
    raw = await fs.readFile(r!.abs, "utf8");
  } catch {
    fail("CONFIG_NOT_FOUND", `mcp config not found: ${configRel} (vedi examples/mcp-servers.json)`);
    throw new Error("unreachable");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw!);
  } catch {
    fail("BAD_ARGS", `mcp config is not valid JSON: ${configRel}`);
    throw new Error("unreachable");
  }
  const servers = (parsed as { mcp?: { servers?: Record<string, McpServerConfig> } }).mcp?.servers;
  if (!servers || typeof servers !== "object") fail("BAD_ARGS", `mcp config missing mcp.servers: ${configRel}`);
  const cfg = servers![name];
  if (!cfg) fail("SERVER_NOT_FOUND", `mcp server not found: ${name} in ${configRel}`);
  if (typeof cfg!.command !== "string" || !cfg!.command.trim()) fail("BAD_ARGS", `mcp server ${name} missing command`);
  return { cfg: cfg!, configFile: configRel };
}

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  timer: NodeJS.Timeout;
}

class McpStdio {
  private child: ChildProcess;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor(
    private ctx: ToolContext,
    command: string,
    args: string[],
    env: Record<string, string>,
    private timeoutMs: number,
  ) {
    const full = [command, ...args].join(" ");
    if (isDangerousCommand(full)) fail("POLICY_DENIED", "dangerous mcp server command blocked");
    this.child = spawn(command, args, { cwd: ctx.cwd, env: { ...process.env, ...env }, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const rl = readline.createInterface({ input: this.child.stdout!, crlfDelay: Infinity });
    rl.on("line", (line) => this.onLine(line));
    this.child.on("error", (e) => this.onError(e));
    this.child.stderr?.on("data", (d) => ctx.logger.debug("mcp stderr", { text: String(d).slice(0, 300) }));
  }

  private onError(e: unknown): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(Object.assign(new Error(`mcp spawn failed: ${e instanceof Error ? e.message : String(e)}`), { code: "SPAWN_FAILED" }));
    }
    this.pending.clear();
  }

  private onLine(line: string): void {
    const s = line.trim();
    if (!s) return;
    let msg: { id?: number; result?: unknown; error?: { code?: number; message?: string } };
    try {
      msg = JSON.parse(s);
    } catch {
      return;
    }
    if (typeof msg.id !== "number") return;
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.error) p.reject(Object.assign(new Error(`mcp error ${msg.error.code ?? ""}: ${msg.error.message ?? "unknown"}`), { code: "MCP_ERROR" }));
    else p.resolve(msg.result);
  }

  request(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Object.assign(new Error(`mcp timeout after ${this.timeoutMs}ms on ${method}`), { code: "MCP_TIMEOUT" }));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin!.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  notify(method: string, params?: unknown): void {
    this.child.stdin!.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  kill(): void {
    try {
      this.child.kill();
    } catch {
      /* niente */
    }
  }
}

export async function mcpCallLogic(ctx: ToolContext, input: McpCallInput): Promise<McpCallOutput> {
  const server = (input.server ?? "").trim();
  const tool = (input.tool ?? "").trim();
  if (!server) fail("BAD_ARGS", "server is required");
  if (!tool) fail("BAD_ARGS", "tool is required");
  if (/[^a-zA-Z0-9_.-]/.test(server) || /[^a-zA-Z0-9_.-]/.test(tool)) fail("BAD_ARGS", "server/tool solo [a-zA-Z0-9_.-]");
  const callArgs = input.args ?? {};
  if (typeof callArgs !== "object" || Array.isArray(callArgs)) fail("BAD_ARGS", "args must be an object");
  const timeoutMs = input.timeoutMs ?? 30_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 5000 || timeoutMs > 120_000) fail("BAD_ARGS", "timeoutMs must be 5000..120000");
  const configRel = (input.config ?? "mcp-servers.json").trim() || "mcp-servers.json";

  const { cfg } = await loadServer(ctx, configRel, server);
  const cmdArgs = Array.isArray(cfg.args) ? cfg.args : [];
  const client = new McpStdio(ctx, cfg.command, cmdArgs, cfg.env ?? {}, timeoutMs);
  try {
    await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "ai-tools", version: MCP_CALL_VERSION },
    });
    client.notify("notifications/initialized", {});
    const listed = (await client.request("tools/list", {})) as { tools?: { name: string }[] };
    const names = Array.isArray(listed?.tools) ? listed.tools.map((t) => t.name) : [];
    if (!names.includes(tool)) fail("MCP_ERROR", `tool not found on server ${server}: ${tool} (ha: ${names.join(", ") || "nessuno"})`);
    const result = await client.request("tools/call", { name: tool, arguments: callArgs });
    const text = JSON.stringify(result);
    const truncated = text.length > MAX_RESULT;
    return { server, tool, result: truncated ? JSON.parse(text.slice(0, MAX_RESULT)) : result, truncated };
  } finally {
    client.kill();
  }
}
