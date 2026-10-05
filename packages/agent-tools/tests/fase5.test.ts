import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createContext } from "../src/core/context.js";
import { MemoryAudit } from "../src/core/audit.js";
import { wrapDefinition } from "../src/core/guarded.js";
import { standardPolicy } from "../src/core/policy.js";
import { acceptAllApprover, denyAllApprover } from "../src/core/approval.js";
import { shellSessionDefinition } from "../src/tools/shell-session/definition.js";
import { gitWriteDefinition } from "../src/tools/git-write/definition.js";
import { testRunnerDefinition } from "../src/tools/test-runner/definition.js";
import { lintFixDefinition } from "../src/tools/lint-fix/definition.js";
import { secureDefinitions } from "../examples/secure-register.js";

const execFileAsync = promisify(execFile);
let tmp: string;

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-fase5-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src/a.txt"), "hello\n", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("fase5 loop dev", () => {
  it("secure-register espone 40 tool", () => {
    expect(secureDefinitions(tmp).length).toBe(40);
  });

  it("shell_session start->poll->kill su processo veloce", async () => {
    const ctx = createContext(tmp);
    ctx.approver = acceptAllApprover;
    const audit = new MemoryAudit();
    const g = wrapDefinition(shellSessionDefinition, { policy: standardPolicy, audit });
    const started = await g.execute({ args: { action: "start", cmd: "node", args: ["-e", "console.log('ciao-sessione')"] }, ctx });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const id = started.data.session!.id;
    let out = "";
    for (let i = 0; i < 40; i++) {
      const p = await g.execute({ args: { action: "poll", id }, ctx });
      expect(p.ok).toBe(true);
      if (p.ok && p.data.output) out += p.data.output;
      if (p.ok && !p.data.session!.running) break;
      await sleep(100);
    }
    expect(out).toContain("ciao-sessione");
    const killed = await g.execute({ args: { action: "kill", id }, ctx });
    expect(killed.ok).toBe(true);
  });

  it("shell_session con deny non parte", async () => {
    const ctx = createContext(tmp);
    ctx.approver = denyAllApprover;
    const g = wrapDefinition(shellSessionDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { action: "start", cmd: "node", args: ["--version"] }, ctx });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("NEED_APPROVAL");
  });

  it("git_write blocca push e scrive commit locale", async () => {
    await execFileAsync("git", ["init"], { cwd: tmp });
    await execFileAsync("git", ["config", "user.email", "t@t.t"], { cwd: tmp });
    await execFileAsync("git", ["config", "user.name", "t"], { cwd: tmp });
    const ctx = createContext(tmp);
    ctx.approver = acceptAllApprover;
    const g = wrapDefinition(gitWriteDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const added = await g.execute({ args: { op: "add", files: ["src/a.txt"] }, ctx });
    // perm terminal:execute + accept umano -> passa
    expect(added.ok).toBe(true);
    const commit = await g.execute({ args: { op: "commit", msg: "test fase5" }, ctx });
    expect(commit.ok).toBe(true);
    expect(commit.ok && commit.data.code).toBe(0);
  });

  it("test_runner vitest su singolo file", async () => {
    const ctx = createContext(tmp);
    ctx.approver = acceptAllApprover;
    const g = wrapDefinition(testRunnerDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const bad = await g.execute({ args: { runner: "pippo" as never }, ctx });
    expect(bad.ok).toBe(false);
  }, 60_000);

  it("lint_fix rifiuta path fuori cwd e non-JS", async () => {
    const ctx = createContext(tmp);
    ctx.approver = acceptAllApprover;
    const g = wrapDefinition(lintFixDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const trav = await g.execute({ args: { paths: ["../escape.ts"] }, ctx });
    expect(trav.ok).toBe(false);
    const notJs = await g.execute({ args: { paths: ["src/a.txt"] }, ctx });
    expect(notJs.ok).toBe(false);
    expect(notJs.error?.code).toBe("BAD_ARGS");
  });
});
