import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { MemoryAudit } from "../src/core/audit.js";
import { wrapDefinition } from "../src/core/guarded.js";
import { standardPolicy } from "../src/core/policy.js";
import { writerDefinition } from "../src/tools/writer/definition.js";
import { preparerDefinition } from "../src/tools/preparer/definition.js";

let tmp: string;
let audit: MemoryAudit;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-guard-"));
  audit = new MemoryAudit();
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("guarded", () => {
  it("allow passa e audita", async () => {
    const ctx = createContext(tmp);
    const g = wrapDefinition(writerDefinition, { policy: standardPolicy, audit });
    const res = await g.execute({ args: { path: "src/a.txt", content: "hi" }, ctx });
    expect(res.ok).toBe(true);
    expect(audit.entries.length).toBe(1);
    expect(audit.entries[0]!.decision).toBe("allow");
  });

  it("deny blocca write fuori scope con POLICY_DENIED", async () => {
    const ctx = createContext(tmp);
    const g = wrapDefinition(writerDefinition, { policy: standardPolicy, audit });
    const res = await g.execute({ args: { path: "random/out.txt", content: "hi" }, ctx });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("POLICY_DENIED");
    expect(audit.entries[0]!.decision).toBe("deny");
    await expect(fs.stat(path.join(tmp, "random/out.txt"))).rejects.toBeTruthy();
  });

  it("read resta allow", async () => {
    const ctx = createContext(tmp);
    const g = wrapDefinition(preparerDefinition, { policy: standardPolicy, audit });
    const res = await g.execute({ args: { goal: "test" }, ctx });
    expect(res.ok).toBe(true);
  });

  it("dryRunGlobal forza dryRun", async () => {
    const ctx = { ...createContext(tmp), dryRunGlobal: true as const };
    const g = wrapDefinition(writerDefinition, { policy: standardPolicy, audit });
    const res = await g.execute({ args: { path: "src/b.txt", content: "hi" }, ctx });
    expect(res.ok).toBe(true);
    // @ts-expect-error dryRun presente in data
    expect(res.data.dryRun).toBe(true);
    await expect(fs.stat(path.join(tmp, "src/b.txt"))).rejects.toBeTruthy();
  });
});
