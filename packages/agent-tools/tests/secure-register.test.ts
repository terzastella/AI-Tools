import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { MemoryAudit } from "../src/core/audit.js";
import { wrapDefinition } from "../src/core/guarded.js";
import { standardPolicy } from "../src/core/policy.js";
import { editManyDefinition } from "../src/tools/edit-many/definition.js";
import { findFilesDefinition } from "../src/tools/find-files/definition.js";
import { searchTextDefinition } from "../src/tools/search-text/definition.js";
import { askUserDefinition } from "../src/tools/ask-user/definition.js";
import { secureDefinitions } from "../examples/secure-register.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-secure-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src/a.txt"), "hello", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("secure-register", () => {
  it("espone tutti i 31 tool avvolti", () => {
    const defs = secureDefinitions(tmp);
    expect(defs.length).toBe(31);
  });

  it("edit_many verso .env viene bloccato con POLICY_DENIED", async () => {
    const ctx = createContext(tmp);
    const audit = new MemoryAudit();
    const secure = wrapDefinition(editManyDefinition, { policy: standardPolicy, audit });
    const res = await secure.execute({
      args: { edits: [{ path: ".env", oldString: "a", newString: "b" }] },
      ctx,
    });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("POLICY_DENIED");
    expect(audit.entries.some((e) => e.decision === "deny")).toBe(true);
  });

  it("edit_many verso src/ passa e scrive audit allow", async () => {
    const ctx = createContext(tmp);
    const audit = new MemoryAudit();
    const secure = wrapDefinition(editManyDefinition, { policy: standardPolicy, audit });
    const res = await secure.execute({
      args: { edits: [{ path: "src/a.txt", oldString: "hello", newString: "hi" }], dryRun: true },
      ctx,
    });
    expect(res.ok).toBe(true);
    expect(audit.entries.some((e) => e.decision === "allow")).toBe(true);
  });

  it("read-only (find_files, search_text, ask_user) non chiedono scrittura", async () => {
    const ctx = createContext(tmp);
    const audit = new MemoryAudit();
    const f = wrapDefinition(findFilesDefinition, { policy: standardPolicy, audit });
    const s = wrapDefinition(searchTextDefinition, { policy: standardPolicy, audit });
    const a = wrapDefinition(askUserDefinition, { policy: standardPolicy, audit });
    expect((await f.execute({ args: { pattern: "*.txt", paths: ["src"] }, ctx })).ok).toBe(true);
    expect((await s.execute({ args: { pattern: "hello", paths: ["src"] }, ctx })).ok).toBe(true);
    expect((await a.execute({ args: { question: "A o B?", options: [{ label: "A" }, { label: "B" }] }, ctx })).ok).toBe(true);
  });
});
