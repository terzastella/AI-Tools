#!/usr/bin/env node
/** Fake MCP server per test: parla JSON-RPC newline su stdin/stdout. */
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

rl.on("line", (line) => {
  const s = line.trim();
  if (!s) return;
  let msg;
  try {
    msg = JSON.parse(s);
  } catch {
    return;
  }
  const id = msg.id;
  const method = msg.method;
  if (method === "initialize") {
    send({ jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "echo", version: "1.0.0" } } });
    return;
  }
  if (method === "notifications/initialized") return;
  if (method === "tools/list") {
    send({ jsonrpc: "2.0", id, result: { tools: [{ name: "echo", description: "Rimanda gli args", inputSchema: { type: "object" } }] } });
    return;
  }
  if (method === "tools/call") {
    const args = msg.params?.arguments ?? {};
    send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(args) }] } });
    return;
  }
  send({ jsonrpc: "2.0", id, error: { code: -32601, message: `unknown method ${method}` } });
});
