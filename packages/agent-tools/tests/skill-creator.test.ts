import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { skillCreatorLogic } from "../src/tools/skill-creator/logic.js";
import { skillCreatorDefinition } from "../src/tools/skill-creator/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-skill-"));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("skill-creator create_skill", () => {
  it("dryRun genera 5 file senza scrivere", async () => {
    const ctx = createContext(tmp);
    const out = await skillCreatorLogic(ctx, { name: "summarize_code", description: "Summarize code" });
    expect(out.written).toBe(false);
    expect(out.files.length).toBe(5);
    expect(out.files.some((f) => f.path.endsWith("logic.ts"))).toBe(true);
    await expect(fs.stat(path.join(tmp, "src/tools/summarize_code/logic.ts"))).rejects.toBeTruthy();
  });

  it("nome invalido e collisione", async () => {
    const ctx = createContext(tmp);
    await expect(skillCreatorLogic(ctx, { name: "Bad-Name", description: "x" })).rejects.toThrow(/snake_case/);
    await expect(skillCreatorLogic(ctx, { name: "create_file", description: "x" })).rejects.toThrow(/already exists/);
  });

  it("write:true scrive 4 core + doc", async () => {
    const ctx = createContext(tmp);
    const out = await skillCreatorLogic(ctx, { name: "my_tool", description: "My tool", write: true });
    expect(out.written).toBe(true);
    expect(await fs.readFile(path.join(tmp, "src/tools/my_tool/logic.ts"), "utf8")).toContain("my_tool");
  });

  it("definition ok/fail", async () => {
    const ctx = createContext(tmp);
    const res = await skillCreatorDefinition.execute({ args: { name: "demo_tool", description: "demo" }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("create_skill");
    const bad = await skillCreatorDefinition.execute({ args: { name: "bad name", description: "x" }, ctx });
    expect(bad.ok).toBe(false);
    expect(bad.error?.code).toBe("BAD_ARGS");
  });
});
