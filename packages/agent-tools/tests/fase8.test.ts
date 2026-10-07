import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { MemoryAudit } from "../src/core/audit.js";
import { wrapDefinition } from "../src/core/guarded.js";
import { standardPolicy } from "../src/core/policy.js";
import { acceptAllApprover, denyAllApprover } from "../src/core/approval.js";
import { chatWithFallback, echoProvider } from "../src/core/model-router.js";
import { lspBridgeDefinition } from "../src/tools/lsp-bridge/definition.js";
import { budgetStatusDefinition } from "../src/tools/budget-status/definition.js";
import { runSubagentDefinition } from "../src/tools/run-subagent/definition.js";
import { readDefinition } from "../src/tools/read/definition.js";
import { secureDefinitions } from "../examples/secure-register.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-fase8-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(
    path.join(tmp, "src", "math.ts"),
    "export function somma(a: number, b: number): number {\n  return a + b;\n}\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(tmp, "src", "uso.ts"),
    'import { somma } from "./math.js";\n\nexport const doppio = somma(21, 21);\n',
    "utf8",
  );
  await fs.writeFile(path.join(tmp, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true } }), "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

function ctx() {
  const c = createContext(tmp);
  c.approver = acceptAllApprover;
  return c;
}

describe("fase8 cervello", () => {
  it("secure-register espone 53 tool", () => {
    expect(secureDefinitions(tmp).length).toBe(53);
  });

  it("lsp hover mostra il tipo", async () => {
    const g = wrapDefinition(lspBridgeDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { op: "hover", path: "src/uso.ts", line: 3, symbol: "somma" }, ctx: ctx() });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.hover).toContain("somma");
  });

  it("lsp references trova definizione + uso", async () => {
    const g = wrapDefinition(lspBridgeDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { op: "references", path: "src/math.ts", line: 1, symbol: "somma" }, ctx: ctx() });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const files = res.data.references!.map((r) => r.path);
      expect(files).toContain("src/math.ts");
      expect(files).toContain("src/uso.ts");
    }
  });

  it("lsp rename dry propone modifiche senza scrivere", async () => {
    const g = wrapDefinition(lspBridgeDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { op: "rename", path: "src/math.ts", line: 1, symbol: "somma", newName: "addizione" }, ctx: ctx() });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.edits!.length).toBeGreaterThanOrEqual(2);
      expect(res.data.edits!.every((e) => e.newName === "addizione")).toBe(true);
    }
    const after = await fs.readFile(path.join(tmp, "src", "math.ts"), "utf8");
    expect(after).toContain("somma");
  });

  it("budget traccia e blocca oltre il tetto", async () => {
    const c = ctx();
    c.budgetLimit = 10_000_000;
    const read = wrapDefinition(readDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    await read.execute({ args: { path: "src/math.ts" }, ctx: c });
    const g = wrapDefinition(budgetStatusDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const st = await g.execute({ args: { op: "status" }, ctx: c });
    expect(st.ok).toBe(true);
    if (st.ok) {
      expect(st.data.calls).toBeGreaterThan(0);
      expect(st.data.used).toBeGreaterThan(0);
      expect(st.data.limit).toBe(10_000_000);
    }
    c.budgetLimit = 1;
    const blocked = await read.execute({ args: { path: "src/math.ts" }, ctx: c });
    expect(blocked.ok).toBe(false);
    expect(blocked.error?.code).toBe("BUDGET_EXCEEDED");
  });

  it("budget reset azzera (con accept)", async () => {
    const c = ctx();
    const read = wrapDefinition(readDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    await read.execute({ args: { path: "src/math.ts" }, ctx: c });
    const g = wrapDefinition(budgetStatusDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const reset = await g.execute({ args: { op: "reset" }, ctx: c });
    expect(reset.ok).toBe(true);
    if (reset.ok) expect(reset.data.cleared).toBeGreaterThan(0);
  });

  it("run_subagent echo con contesto isolato", async () => {
    const g = wrapDefinition(runSubagentDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { goal: "riassumi", paths: ["src/math.ts"], provider: "echo" }, ctx: ctx() });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.provider).toBe("echo");
      expect(res.data.contextChars).toBeGreaterThan(0);
      expect(res.data.result).toContain("riassumi");
    }
  });

  it("run_subagent con deny non parte, ollama spento dà errore chiaro", async () => {
    const deny = createContext(tmp);
    deny.approver = denyAllApprover;
    const g = wrapDefinition(runSubagentDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const no = await g.execute({ args: { goal: "x", provider: "echo" }, ctx: deny });
    expect(no.ok).toBe(false);
    expect(no.error?.code).toBe("NEED_APPROVAL");
    const off = await g.execute({ args: { goal: "x", provider: "ollama", model: "no-modello-xyz", timeoutMs: 10_000 }, ctx: ctx() });
    expect(off.ok).toBe(false);
    expect(["OLLAMA_MISSING", "MODEL_ERROR", "TIMEOUT"]).toContain(off.error?.code);
  });

  it("router fallback: primo ko, secondo ok", async () => {
    const bad = { name: "ko", chat: async () => { throw Object.assign(new Error("down"), { code: "DOWN" }); } };
    const res = await chatWithFallback(ctx(), [bad, echoProvider], { prompt: "ciao" });
    expect(res.provider).toBe("echo");
    expect(res.text).toContain("ciao");
  });
});
