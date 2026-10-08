import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { delegateLogic } from "../src/tools/delegate/logic.js";
import { delegateDefinition } from "../src/tools/delegate/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-del-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src/writer.ts"), "export function writerLogic() {}\n", "utf8");
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

describe("delegate_task", () => {
  it("piano + todo + verifica read-only", async () => {
    const ctx = createContext(tmp);
    const out = await delegateLogic(ctx, { goal: "writer cleanup", paths: ["src"], maxSteps: 2 });
    expect(out.steps.length).toBeGreaterThan(0);
    expect(out.todoIds.length).toBe(out.steps.length);
    expect(out.summary).toContain("Capo-cantiere");
  });

  it("goal vuoto e traversal", async () => {
    const ctx = createContext(tmp);
    await expect(delegateLogic(ctx, { goal: "  " })).rejects.toThrow(/goal/);
    await expect(delegateLogic(ctx, { goal: "x", paths: ["../escape"] })).rejects.toThrow(/escapes/);
  });

  it("definition ok", async () => {
    const ctx = createContext(tmp);
    const res = await delegateDefinition.execute({ args: { goal: "test", paths: ["src"], maxSteps: 1 }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("delegate_task");
  });
});
