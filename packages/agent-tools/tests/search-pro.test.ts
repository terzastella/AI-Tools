import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { searchProLogic } from "../src/tools/search-pro/logic.js";
import { searchProDefinition } from "../src/tools/search-pro/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-sp-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src/writer.ts"), "export function writerLogic() { return 1; }\n", "utf8");
  await fs.writeFile(path.join(tmp, "src/other.ts"), "export const x = 1;\n", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("search_pro", () => {
  it("titolo prima", async () => {
    const ctx = createContext(tmp);
    const out = await searchProLogic(ctx, { query: "writer" });
    expect(out.hits[0]!.path).toContain("writer");
    expect(out.hits[0]!.snippets.length).toBeGreaterThan(0);
  });

  it("traversal e query vuota", async () => {
    const ctx = createContext(tmp);
    await expect(searchProLogic(ctx, { query: "  " })).rejects.toThrow(/query/);
    await expect(searchProLogic(ctx, { query: "x", paths: ["../escape"] })).rejects.toThrow(/escapes/);
  });

  it("definition ok", async () => {
    const ctx = createContext(tmp);
    const res = await searchProDefinition.execute({ args: { query: "writer" }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("search_pro");
  });
});
