import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { gotoLogic } from "../src/tools/goto/logic.js";
import { gotoDefinition } from "../src/tools/goto/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-goto-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src/a.ts"), "export function writerLogic() { return 1; }\n", "utf8");
  await fs.writeFile(path.join(tmp, "src/b.ts"), 'import { writerLogic } from "./a.js";\nwriterLogic();\n', "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("go_to_definition", () => {
  it("trova export function", async () => {
    const ctx = createContext(tmp);
    const out = await gotoLogic(ctx, { symbol: "writerLogic", paths: ["src"] });
    expect(out.locations.length).toBeGreaterThan(0);
    expect(out.locations[0]!.path).toContain("a.ts");
  });

  it("fromFile privilegia import", async () => {
    const ctx = createContext(tmp);
    const out = await gotoLogic(ctx, { symbol: "writerLogic", fromFile: "src/b.ts", paths: ["src"] });
    expect(out.locations[0]!.path).toContain("a.ts");
  });

  it("simbolo invalido e traversal", async () => {
    const ctx = createContext(tmp);
    await expect(gotoLogic(ctx, { symbol: "bad-name" })).rejects.toThrow();
    await expect(gotoLogic(ctx, { symbol: "x", paths: ["../escape"] })).rejects.toThrow(/escapes/);
  });

  it("definition ok", async () => {
    const ctx = createContext(tmp);
    const res = await gotoDefinition.execute({ args: { symbol: "writerLogic", paths: ["src"] }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("go_to_definition");
  });
});
