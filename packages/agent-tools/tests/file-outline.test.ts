import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { fileOutlineLogic } from "../src/tools/file-outline/logic.js";
import { fileOutlineDefinition } from "../src/tools/file-outline/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-outline-"));
  await fs.writeFile(path.join(tmp, "a.ts"), "export function hello() {}\nexport class Foo {}\nconst x = 1;\n", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("file_outline", () => {
  it("estrae simboli con righe", async () => {
    const ctx = createContext(tmp);
    const out = await fileOutlineLogic(ctx, { path: "a.ts" });
    expect(out.symbols.some((s) => s.name === "hello")).toBe(true);
    expect(out.symbols.some((s) => s.name === "Foo")).toBe(true);
  });

  it("definition ok/fail", async () => {
    const ctx = createContext(tmp);
    const res = await fileOutlineDefinition.execute({ args: { path: "a.ts" }, ctx });
    expect(res.ok).toBe(true);
    const bad = await fileOutlineDefinition.execute({ args: { path: "../escape" }, ctx });
    expect(bad.ok).toBe(false);
  });
});
