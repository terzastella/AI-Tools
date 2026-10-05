import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { searchTextLogic } from "../src/tools/search-text/logic.js";
import { searchTextDefinition } from "../src/tools/search-text/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-stext-"));
  await fs.writeFile(path.join(tmp, "a.ts"), "hello foo\nsecond TODO line\nthird foo bar", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("search_text", () => {
  it("trova regex con riga e colonna", async () => {
    const ctx = createContext(tmp);
    const out = await searchTextLogic(ctx, { pattern: "foo|TODO" });
    expect(out.matches.length).toBe(3);
    expect(out.files).toBe(1);
  });

  it("pattern invalido e traversal", async () => {
    const ctx = createContext(tmp);
    await expect(searchTextLogic(ctx, { pattern: "[" })).rejects.toThrow(/invalid regex/);
    await expect(searchTextLogic(ctx, { pattern: "x", paths: ["../escape"] })).rejects.toThrow(/escapes/);
  });

  it("definition ok", async () => {
    const ctx = createContext(tmp);
    const res = await searchTextDefinition.execute({ args: { pattern: "foo", include: "*.ts" }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("search_text");
  });
});
