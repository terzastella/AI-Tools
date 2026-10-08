import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { diagnoseLogic } from "../src/tools/diagnose/logic.js";
import { diagnoseDefinition } from "../src/tools/diagnose/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-diag-"));
  await fs.writeFile(path.join(tmp, "package.json"), JSON.stringify({ type: "module" }), "utf8");
  await fs.writeFile(
    path.join(tmp, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ["./**/*"] }),
    "utf8",
  );
  await fs.writeFile(path.join(tmp, "good.ts"), "export const x: number = 1;\n", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("diagnose", () => {
  it("file pulito = zero tsc", async () => {
    const ctx = createContext(tmp);
    const out = await diagnoseLogic(ctx, {});
    expect(out.ran.tsc).toBe(true);
    expect(out.summary.tsc).toBe(0);
  });

  it("trova errore tsc vero", async () => {
    const ctx = createContext(tmp);
    await fs.writeFile(path.join(tmp, "bad.ts"), "export const y: number = 'oops';\n", "utf8");
    const out = await diagnoseLogic(ctx, {});
    expect(out.summary.tsc).toBeGreaterThan(0);
    expect(out.issues[0]!.source).toBe("tsc");
  });

  it("traversal block", async () => {
    const ctx = createContext(tmp);
    await expect(diagnoseLogic(ctx, { paths: ["../escape"] })).rejects.toThrow(/escapes/);
  });

  it("runTests:false di default non lancia vitest", async () => {
    const ctx = createContext(tmp);
    const out = await diagnoseLogic(ctx, {});
    expect(out.ran.vitest).toBe(false);
  });

  it("definition ok", async () => {
    const ctx = createContext(tmp);
    const res = await diagnoseDefinition.execute({ args: {}, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("diagnose");
  });
});
