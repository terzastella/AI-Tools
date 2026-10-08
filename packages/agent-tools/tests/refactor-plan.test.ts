import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { refactorPlanLogic } from "../src/tools/refactor-plan/logic.js";
import { refactorPlanDefinition } from "../src/tools/refactor-plan/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-ref-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src/writer.ts"), "export function writerLogic() {}\nconsole.log(1);\n", "utf8");
  await fs.writeFile(path.join(tmp, "src/other.ts"), "export const x = 1;\n", "utf8");
  await fs.writeFile(path.join(tmp, "package.json"), JSON.stringify({ type: "module" }), "utf8");
  await fs.writeFile(
    path.join(tmp, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ["./**/*"] }),
    "utf8",
  );
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("refactor-plan v1.1 furbo equilibrato", () => {
  it("rotti veri prima dei simili", async () => {
    const ctx = createContext(tmp);
    await fs.writeFile(path.join(tmp, "src/broken.ts"), "export const z: number = 'oops';\n", "utf8");
    const out = await refactorPlanLogic(ctx, { goal: "broken fix", paths: ["src"], maxSteps: 5 });
    expect(out.steps.length).toBeGreaterThan(0);
    expect(out.steps[0]!.path).toContain("broken");
    expect(out.steps[0]!.hint).toContain("riga");
  });

  it("patch su file multi-problema", async () => {
    const ctx = createContext(tmp);
    await fs.writeFile(
      path.join(tmp, "src/messy.ts"),
      "export const a: any = 1;\nconsole.log(a);\n// TODO fix\n",
      "utf8",
    );
    const out = await refactorPlanLogic(ctx, { goal: "messy cleanup", paths: ["src"], maxSteps: 5 });
    const step = out.steps.find((s) => s.path.includes("messy"));
    expect(step).toBeDefined();
    expect(step!.kind).toBe("patch");
  });

  it("rischio secrets quando c'è chiave", async () => {
    const ctx = createContext(tmp);
    await fs.writeFile(path.join(tmp, "src/s.ts"), "export const secret_key = \"api_key = 'abcd1234'\";\n", "utf8");
    const out = await refactorPlanLogic(ctx, { goal: "secret check", paths: ["src"], maxSteps: 5 });
    expect(out.risks.some((r) => r.toLowerCase().includes("secret"))).toBe(true);
  });

  it("goal vuoto e traversal", async () => {
    const ctx = createContext(tmp);
    await expect(refactorPlanLogic(ctx, { goal: "  " })).rejects.toThrow(/goal/);
    await expect(refactorPlanLogic(ctx, { goal: "x", paths: ["../escape"] })).rejects.toThrow(/escapes/);
  });

  it("definition ok/fail", async () => {
    const ctx = createContext(tmp);
    const res = await refactorPlanDefinition.execute({ args: { goal: "cleanup writer", paths: ["src"] }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("refactor_plan");
    const bad = await refactorPlanDefinition.execute({ args: { goal: "  " }, ctx });
    expect(bad.ok).toBe(false);
  });
});
