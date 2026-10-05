import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { listLogic } from "../src/tools/list/logic.js";
import { listDefinition } from "../src/tools/list/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-list-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src/a.ts"), "x", "utf8");
  await fs.writeFile(path.join(tmp, "top.txt"), "y", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("list_directory", () => {
  it("elenca dir prima dei file", async () => {
    const ctx = createContext(tmp);
    const out = await listLogic(ctx, { path: "." });
    expect(out.entries.some((e) => e.name === "src" && e.type === "dir")).toBe(true);
    expect(out.entries.some((e) => e.name === "top.txt")).toBe(true);
  });

  it("ricorsivo trova annidati", async () => {
    const ctx = createContext(tmp);
    const out = await listLogic(ctx, { path: ".", recursive: true });
    expect(out.entries.some((e) => e.path.includes("src/a.ts"))).toBe(true);
  });

  it("blocca traversal e non-dir", async () => {
    const ctx = createContext(tmp);
    await expect(listLogic(ctx, { path: "../escape" })).rejects.toThrow(/escapes/);
    await expect(listLogic(ctx, { path: "top.txt" })).rejects.toThrow(/not a directory/);
  });

  it("definition ok/fail", async () => {
    const ctx = createContext(tmp);
    const res = await listDefinition.execute({ args: { path: "src" }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("list_directory");
    const bad = await listDefinition.execute({ args: { path: "../escape" }, ctx });
    expect(bad.ok).toBe(false);
  });
});
