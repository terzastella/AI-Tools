#!/usr/bin/env node
/**
 * AI-Tools MCP server (stdio): espone le 53 ToolDefinition via
 * initialize + tools/list + tools/call, così opencode e agenti MCP
 * li usano senza scrivere codice.
 *
 * Uso: prima `pnpm build` in packages/agent-tools (serve dist/),
 * poi punta opencode.json qui. Vedi examples/opencode.json.
 *
 * Sicurezza onesta: gira in policy-only (standardPolicy + audit file),
 * SENZA approver umano. In opencode i permessi li chiede lui
 * (permission: { "ai-tools_*": "ask" }). Comandi pericolosi bloccati comunque.
 */
import { readFileSync } from "node:fs";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const distIndex = path.resolve(here, "../../packages/agent-tools/dist/index.js");
const pkgJson = path.resolve(here, "../../packages/agent-tools/package.json");

let kit;
try {
  kit = await import(pathToFileURL(distIndex).href);
} catch {
  console.error(`[ai-tools-mcp] dist mancante: esegui prima 'pnpm build' in packages/agent-tools.\nCerco: ${distIndex}`);
  process.exit(1);
}

let version = "0.0.0";
try {
  version = JSON.parse(readFileSync(pkgJson, "utf8")).version ?? version;
} catch {
  /* default */
}

const cwd = process.env["AI_TOOLS_CWD"] || process.cwd();
const defs = Object.values(kit).filter(
  (v) => v && typeof v === "object" && typeof v.name === "string" && v.parameters && typeof v.execute === "function",
);
const byName = new Map(defs.map((d) => [d.name, d]));
const ctx = kit.createContext(cwd);
const audit = new kit.FileAudit(cwd);
const wrapped = new Map([...byName.entries()].map(([n, d]) => [n, kit.wrapDefinition(d, { policy: kit.standardPolicy, audit })]));

function send(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", async (line) => {
  const s = line.trim();
  if (!s) return;
  let msg;
  try {
    msg = JSON.parse(s);
  } catch {
    return;
  }
  const id = msg.id;
  try {
    if (msg.method === "initialize") {
      send({ jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "ai-tools", version } } });
    } else if (msg.method === "notifications/initialized") {
      /* nessun ack */
    } else if (msg.method === "tools/list") {
      send({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [...byName.values()].map((d) => ({ name: d.name, description: `${d.label}: ${d.description}`.slice(0, 500), inputSchema: d.parameters })),
        },
      });
    } else if (msg.method === "tools/call") {
      const name = msg.params?.name;
      const args = msg.params?.arguments ?? {};
      const def = wrapped.get(name);
      if (!def) {
        send({ jsonrpc: "2.0", id, error: { code: -32602, message: `unknown tool: ${name}` } });
        return;
      }
      const res = await def.execute({ args, ctx });
      send({
        jsonrpc: "2.0",
        id,
        result: res.ok
          ? { content: [{ type: "text", text: JSON.stringify(res.data) }] }
          : { content: [{ type: "text", text: `ERROR ${res.error.code}: ${res.error.message}` }], isError: true },
      });
    } else {
      send({ jsonrpc: "2.0", id, error: { code: -32601, message: `unknown method ${msg.method}` } });
    }
  } catch (e) {
    send({ jsonrpc: "2.0", id, error: { code: -32603, message: String(e?.message ?? e).slice(0, 300) } });
  }
});
