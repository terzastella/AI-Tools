import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { MemoryAudit } from "../src/core/audit.js";
import { wrapDefinition } from "../src/core/guarded.js";
import { standardPolicy } from "../src/core/policy.js";
import { acceptAllApprover, denyAllApprover } from "../src/core/approval.js";
import { mcpCallDefinition } from "../src/tools/mcp-call/definition.js";

const PKG = process.cwd();
const ECHO_CONFIG = "tests/fixtures/mcp-servers.echo.json";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-fase4-"));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("fase4 mcp_call via MCP", () => {
  it("echo roundtrip con accept (initialize + list + call veri)", async () => {
    const ctx = createContext(PKG);
    ctx.approver = acceptAllApprover;
    const g = wrapDefinition(mcpCallDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({
      args: { server: "echo", tool: "echo", args: { hello: "mondo" }, config: ECHO_CONFIG },
      ctx,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.server).toBe("echo");
      const text = (res.data.result as { content: { text: string }[] }).content[0]!.text;
      expect(JSON.parse(text)).toEqual({ hello: "mondo" });
      expect(res.data.truncated).toBe(false);
    }
  });

  it("deny blocca prima di spawnare (NEED_APPROVAL)", async () => {
    const ctx = createContext(PKG);
    ctx.approver = denyAllApprover;
    const audit = new MemoryAudit();
    const g = wrapDefinition(mcpCallDefinition, { policy: standardPolicy, audit });
    const res = await g.execute({ args: { server: "echo", tool: "echo", args: {}, config: ECHO_CONFIG }, ctx });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("NEED_APPROVAL");
    expect(audit.entries[0]!.decision).toBe("need_approval");
  });

  it("config mancante -> CONFIG_NOT_FOUND chiaro", async () => {
    const ctx = createContext(tmp);
    ctx.approver = acceptAllApprover;
    const g = wrapDefinition(mcpCallDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { server: "web", tool: "fetch", config: "mcp-servers.json" }, ctx });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("CONFIG_NOT_FOUND");
  });

  it("server sconosciuto -> SERVER_NOT_FOUND", async () => {
    const ctx = createContext(PKG);
    ctx.approver = acceptAllApprover;
    const g = wrapDefinition(mcpCallDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { server: "fantasma", tool: "x", config: ECHO_CONFIG }, ctx });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("SERVER_NOT_FOUND");
  });

  it("tool sconosciuto sul server -> MCP_ERROR", async () => {
    const ctx = createContext(PKG);
    ctx.approver = acceptAllApprover;
    const g = wrapDefinition(mcpCallDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { server: "echo", tool: "fantasma", config: ECHO_CONFIG }, ctx });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("MCP_ERROR");
  });
});
