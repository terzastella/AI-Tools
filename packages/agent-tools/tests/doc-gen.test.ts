import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { docGenLogic } from "../src/tools/doc-gen/logic.js";
import { docGenDefinition } from "../src/tools/doc-gen/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-doc-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src/a.ts"), "export function hello() {}\nexport const x = 1;\n", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("doc-gen generate_docs", () => {
  it("genera markdown con exports", async () => {
    const ctx = createContext(tmp);
    const out = await docGenLogic(ctx, { paths: ["src"] });
    expect(out.docs.length).toBeGreaterThan(0);
    expect(out.docs[0]!.exports).toContain("hello");
    expect(out.indexMd).toContain("Index");
  });

  it("style jsdoc", async () => {
    const ctx = createContext(tmp);
    const out = await docGenLogic(ctx, { paths: ["src"], style: "jsdoc" });
    expect(out.docs[0]!.markdown).toContain("/**");
  });

  it("traversal block", async () => {
    const ctx = createContext(tmp);
    await expect(docGenLogic(ctx, { paths: ["../escape"] })).rejects.toThrow(/escapes/);
  });

  it("definition ok/fail", async () => {
    const ctx = createContext(tmp);
    const res = await docGenDefinition.execute({ args: { paths: ["src"] }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("generate_docs");
    const bad = await docGenDefinition.execute({ args: { paths: ["../escape"] }, ctx });
    expect(bad.ok).toBe(false);
  });
});
