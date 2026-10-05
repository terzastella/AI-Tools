import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { renameLogic } from "../src/tools/rename/logic.js";
import { renameDefinition } from "../src/tools/rename/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-ren-"));
  await fs.writeFile(path.join(tmp, "a.ts"), "export function foo() { return foo(); }\nconst foobar = 1;\n", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("rename_symbol", () => {
  it("whole-word senza toccare foobar", async () => {
    const ctx = createContext(tmp);
    const out = await renameLogic(ctx, { oldName: "foo", newName: "bar" });
    expect(out.total).toBe(2);
    const c = await fs.readFile(path.join(tmp, "a.ts"), "utf8");
    expect(c).toContain("bar()");
    expect(c).toContain("foobar");
  });

  it("dryRun non scrive", async () => {
    const ctx = createContext(tmp);
    await renameLogic(ctx, { oldName: "foo", newName: "bar", dryRun: true });
    expect(await fs.readFile(path.join(tmp, "a.ts"), "utf8")).toContain("foo()");
  });

  it("nomi invalidi", async () => {
    const ctx = createContext(tmp);
    await expect(renameLogic(ctx, { oldName: "bad-name", newName: "x" })).rejects.toThrow();
    await expect(renameLogic(ctx, { oldName: "foo", newName: "foo" })).rejects.toThrow(/identical/);
  });

  it("definition ok", async () => {
    const ctx = createContext(tmp);
    const res = await renameDefinition.execute({ args: { oldName: "foo", newName: "baz", dryRun: true }, ctx });
    expect(res.ok).toBe(true);
  });
});
