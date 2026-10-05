import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { preparerLogic } from "../src/tools/preparer/logic.js";
import { preparerDefinition } from "../src/tools/preparer/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-prep-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src/writer.ts"), "export function writerLogic() { return 'writer'; }\n", "utf8");
  await fs.writeFile(path.join(tmp, "src/editor.ts"), "export function editorLogic() { return 'editor'; }\n", "utf8");
  await fs.writeFile(path.join(tmp, "README.md"), "# demo\n", "utf8");
  await fs.mkdir(path.join(tmp, "node_modules/fake"), { recursive: true });
  await fs.writeFile(path.join(tmp, "node_modules/fake/writer.ts"), "writer fake", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("preparer prepare_context", () => {
  it("trova file rilevanti per goal", async () => {
    const ctx = createContext(tmp);
    const out = await preparerLogic(ctx, { goal: "writer logic" });
    expect(out.files.length).toBeGreaterThan(0);
    expect(out.files[0]!.path).toContain("writer");
    expect(out.plan.steps.length).toBeGreaterThan(0);
  });

  it("ignora node_modules/dist di default", async () => {
    const ctx = createContext(tmp);
    const out = await preparerLogic(ctx, { goal: "writer" });
    expect(out.files.some((f) => f.path.includes("node_modules"))).toBe(false);
  });

  it("rispetta maxFiles + truncated", async () => {
    const ctx = createContext(tmp);
    const out = await preparerLogic(ctx, { goal: "export function", maxFiles: 1 });
    expect(out.files.length).toBeLessThanOrEqual(1);
    expect(out.files.length).toBe(1);
    expect(out.truncated).toBe(true);
  });

  it("tronca snippet a maxBytesPerFile", async () => {
    const ctx = createContext(tmp);
    const token = "bigmarker";
    await fs.writeFile(path.join(tmp, "big.txt"), `${token} ` + "x".repeat(5000), "utf8");
    const out = await preparerLogic(ctx, { goal: token, maxBytesPerFile: 1000 });
    const f = out.files.find((x) => x.path === "big.txt");
    expect(f).toBeDefined();
    expect(f!.snippet.length).toBeLessThanOrEqual(1000 + 100);
    expect(f!.snippet).toContain(token);
  });

  it("blocca traversal", async () => {
    const ctx = createContext(tmp);
    await expect(preparerLogic(ctx, { goal: "writer logic", paths: ["../escape"] })).rejects.toThrow(/escapes/);
  });

  it("goal vuoto -> BAD_ARGS", async () => {
    const ctx = createContext(tmp);
    await expect(preparerLogic(ctx, { goal: "  " })).rejects.toThrow(/goal/);
  });

  it("definition.execute ritorna ok e mappa errori", async () => {
    const ctx = createContext(tmp);
    const res = await preparerDefinition.execute({ args: { goal: "editor" }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("prepare_context");
    const bad = await preparerDefinition.execute({ args: { goal: "  " }, ctx });
    expect(bad.ok).toBe(false);
    expect(bad.error?.code).toBe("BAD_ARGS");
  });
});
