import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { MemoryAudit, FileAudit } from "../src/core/audit.js";

describe("audit", () => {
  it("memory accumula", async () => {
    const m = new MemoryAudit();
    await m.write({
      time: new Date().toISOString(),
      tool: "x",
      ok: true,
      durationMs: 1,
      decision: "allow",
      cwd: "/tmp",
    });
    expect(m.entries.length).toBe(1);
  });

  it("file appende jsonl giornaliero senza throw", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-audit-"));
    try {
      const f = new FileAudit(tmp);
      await f.write({
        time: new Date().toISOString(),
        tool: "create_file",
        ok: true,
        durationMs: 2,
        decision: "allow",
        cwd: tmp,
      });
      const dir = path.join(tmp, ".agent/audit");
      const files = await fs.readdir(dir);
      expect(files.some((x) => x.startsWith("ai-toolkit-") && x.endsWith(".jsonl"))).toBe(true);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("file mai throw su cwd invalido", async () => {
    const f = new FileAudit("/definitely/not/here/\0");
    await expect(
      f.write({ time: "", tool: "x", ok: false, durationMs: 0, decision: "deny", cwd: "" }),
    ).resolves.toBeUndefined();
  });
});
