import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { MemoryAudit } from "../src/core/audit.js";
import { wrapDefinition } from "../src/core/guarded.js";
import { standardPolicy } from "../src/core/policy.js";
import { acceptAllApprover, denyAllApprover } from "../src/core/approval.js";
import { bashExecDefinition } from "../src/tools/bash-exec/definition.js";
import { countTokensDefinition } from "../src/tools/count-tokens/definition.js";
import { chunkTextDefinition } from "../src/tools/chunk-text/definition.js";
import { packContextDefinition } from "../src/tools/pack-context/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-fase3-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src/a.txt"), "hello mondo\nseconda riga\n", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("fase3 bash_exec + nativi", () => {
  it("bash_exec con accept esegue node --version", async () => {
    const ctx = createContext(tmp);
    ctx.approver = acceptAllApprover;
    const g = wrapDefinition(bashExecDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { cmd: "node", args: ["--version"] }, ctx });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.stdout).toMatch(/v\d+\./);
  });

  it("bash_exec con deny non esegue", async () => {
    const ctx = createContext(tmp);
    ctx.approver = denyAllApprover;
    const audit = new MemoryAudit();
    const g = wrapDefinition(bashExecDefinition, { policy: standardPolicy, audit });
    const res = await g.execute({ args: { cmd: "node", args: ["--version"] }, ctx });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("NEED_APPROVAL");
    expect(audit.entries[0]!.decision).toBe("need_approval");
  });

  it("bash_exec blocca comandi pericolosi anche con accept", async () => {
    const ctx = createContext(tmp);
    ctx.approver = acceptAllApprover;
    const g = wrapDefinition(bashExecDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { cmd: "rm", args: ["-rf", "/"] }, ctx });
    expect(res.ok).toBe(false);
  });

  it("bash_exec rifiuta shell e workdir fuori cwd", async () => {
    const ctx = createContext(tmp);
    ctx.approver = acceptAllApprover;
    const g = wrapDefinition(bashExecDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const bad = await g.execute({ args: { cmd: "node --version" }, ctx });
    expect(bad.ok).toBe(false);
    const trav = await g.execute({ args: { cmd: "node", args: ["--version"], workdir: "../escape" }, ctx });
    expect(trav.ok).toBe(false);
  });

  it("count_tokens come token_count.py", async () => {
    const ctx = createContext(tmp);
    const g = wrapDefinition(countTokensDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { text: "ciao mondo" }, ctx });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.chars).toBe(10);
      expect(res.data.words).toBe(2);
      expect(res.data.est_tokens).toBe(2);
    }
  });

  it("chunk_text come chunker.py con overlap", async () => {
    const ctx = createContext(tmp);
    const g = wrapDefinition(chunkTextDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const text = `${"a".repeat(900)}\n${"b".repeat(900)}`;
    const res = await g.execute({ args: { text, max_chars: 1000, overlap: 100 }, ctx });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.count).toBeGreaterThan(1);
      expect(res.data.chunks.join("").length).toBeGreaterThan(1000);
    }
  });

  it("pack_context legge file dentro cwd e rispetta budget", async () => {
    const ctx = createContext(tmp);
    const g = wrapDefinition(packContextDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { paths: ["src/a.txt"], max_chars: 5000 }, ctx });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.files).toEqual(["src/a.txt"]);
      expect(res.data.packed).toContain("hello mondo");
      expect(res.data.truncated).toBe(false);
    }
  });

  it("pack_context non esce dal cwd", async () => {
    const ctx = createContext(tmp);
    const g = wrapDefinition(packContextDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { paths: ["../escape.txt"] }, ctx });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.files).toEqual([]);
  });
});
