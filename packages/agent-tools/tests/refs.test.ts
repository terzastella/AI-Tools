import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { refsLogic } from "../src/tools/refs/logic.js";
import { refsDefinition } from "../src/tools/refs/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-refs-"));
  await fs.writeFile(path.join(tmp, "a.ts"), "export function foo() {}\nfoo();\n", "utf8");
  await fs.writeFile(path.join(tmp, "b.ts"), 'import { foo } from "./a.js";\nfoo();\n', "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("find_references", () => {
  it("trova usi senza definizione", async () => {
    const ctx = createContext(tmp);
    const out = await refsLogic(ctx, { symbol: "foo" });
    expect(out.matches.length).toBeGreaterThanOrEqual(2);
    expect(out.files).toBeGreaterThanOrEqual(1);
  });

  it("simbolo invalido e traversal", async () => {
    const ctx = createContext(tmp);
    await expect(refsLogic(ctx, { symbol: "bad-name" })).rejects.toThrow();
    await expect(refsLogic(ctx, { symbol: "x", paths: ["../escape"] })).rejects.toThrow(/escapes/);
  });

  it("definition ok", async () => {
    const ctx = createContext(tmp);
    const res = await refsDefinition.execute({ args: { symbol: "foo" }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("find_references");
  });
});
