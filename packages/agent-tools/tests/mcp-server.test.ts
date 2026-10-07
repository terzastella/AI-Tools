import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import readline from "node:readline";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(process.cwd(), "..", "..");
const SERVER = path.join(REPO, "servers", "ai-tools-mcp", "server.mjs");
const DIST = path.join(REPO, "packages", "agent-tools", "dist", "index.js");

let tmp: string;
let child: ChildProcess;
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();

function call(method: string, params: unknown): Promise<unknown> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin!.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-mcp-srv-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src", "a.txt"), "ciao mcp\n", "utf8");
  try {
    await fs.access(DIST);
  } catch {
    throw new Error("dist mancante: esegui 'pnpm build' prima (o usa pnpm test con pretest)");
  }
  child = spawn("node", [SERVER], { env: { ...process.env, AI_TOOLS_CWD: tmp }, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const rl = readline.createInterface({ input: child.stdout!, crlfDelay: Infinity });
  rl.on("line", (line) => {
    const s = line.trim();
    if (!s) return;
    let msg: { id?: number; result?: unknown; error?: { message?: string } };
    try {
      msg = JSON.parse(s);
    } catch {
      return;
    }
    if (typeof msg.id !== "number") return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message ?? "mcp error"));
    else p.resolve(msg.result);
  });
});

afterEach(async () => {
  try {
    child.kill();
  } catch {
    /* niente */
  }
  pending.clear();
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("mcp server ai-tools", () => {
  it("initialize + list espone 53 tool", async () => {
    const init = (await call("initialize", {})) as { serverInfo: { name: string } };
    expect(init.serverInfo.name).toBe("ai-tools");
    const list = (await call("tools/list", {})) as { tools: { name: string }[] };
    expect(list.tools.length).toBe(53);
    expect(list.tools.map((t) => t.name)).toContain("bash_exec");
  }, 30_000);

  it("call read_file legge dentro AI_TOOLS_CWD", async () => {
    await call("initialize", {});
    const res = (await call("tools/call", { name: "read_file", arguments: { path: "src/a.txt" } })) as {
      content: { text: string }[];
    };
    expect(res.content[0]!.text).toContain("ciao mcp");
  }, 30_000);

  it("call tool sconosciuto -> errore", async () => {
    await call("initialize", {});
    await expect(call("tools/call", { name: "fantasma", arguments: {} })).rejects.toThrow("unknown tool");
  }, 30_000);
});
