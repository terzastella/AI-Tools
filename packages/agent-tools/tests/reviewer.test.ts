import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { reviewerLogic } from "../src/tools/reviewer/logic.js";
import { reviewerDefinition } from "../src/tools/reviewer/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-rev-"));
  await fs.writeFile(path.join(tmp, "good.ts"), "export const x = 1;\n", "utf8");
  await fs.writeFile(path.join(tmp, "bad.ts"), "export const y: any = 1;\nconsole.log(y);\n// TODO fix\n", "utf8");
  await fs.mkdir(path.join(tmp, "node_modules/fake"), { recursive: true });
  await fs.writeFile(path.join(tmp, "node_modules/fake/bad.ts"), "console.log(1);\n", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("reviewer review_code", () => {
  it("trova no-any, console, todo", async () => {
    const ctx = createContext(tmp);
    const out = await reviewerLogic(ctx, { paths: ["bad.ts"], useDiagnose: false });
    const rules = out.issues.map((i) => i.rule);
    expect(rules).toContain("no-any");
    expect(rules).toContain("no-console-log");
    expect(rules).toContain("todo-fixme");
  });

  it("file pulito ha zero issue", async () => {
    const ctx = createContext(tmp);
    const out = await reviewerLogic(ctx, { paths: ["good.ts"], useDiagnose: false });
    expect(out.issues.length).toBe(0);
    expect(out.summary.files).toBe(1);
  });

  it("ignora node_modules", async () => {
    const ctx = createContext(tmp);
    const out = await reviewerLogic(ctx, { paths: ["."], useDiagnose: false });
    expect(out.issues.some((i) => i.path.includes("node_modules"))).toBe(false);
  });

  it("secret-like è error", async () => {
    const ctx = createContext(tmp);
    await fs.writeFile(path.join(tmp, "s.ts"), "const x = \"api_key = 'abcd1234'\";\n", "utf8");
    const out = await reviewerLogic(ctx, { paths: ["s.ts"], useDiagnose: false });
    expect(out.issues.some((i) => i.rule === "secret-like" && i.severity === "error")).toBe(true);
  });

  it("useDiagnose:true aggiunge tsc-error veri", async () => {
    const ctx = createContext(tmp);
    await fs.writeFile(path.join(tmp, "package.json"), JSON.stringify({ type: "module" }), "utf8");
    await fs.writeFile(
      path.join(tmp, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ["./**/*"] }),
      "utf8",
    );
    await fs.writeFile(path.join(tmp, "broken.ts"), "export const z: number = 'sbaglio';\n", "utf8");
    const out = await reviewerLogic(ctx, { paths: ["broken.ts"], useDiagnose: true });
    expect(out.diagnosed).toBe(true);
    expect(out.issues.some((i) => i.rule === "tsc-error" && i.severity === "error")).toBe(true);
  });

  it("blocca traversal e regola ignota", async () => {
    const ctx = createContext(tmp);
    await expect(reviewerLogic(ctx, { paths: ["../escape"] })).rejects.toThrow(/escapes/);
    // @ts-expect-error test regola invalida
    await expect(reviewerLogic(ctx, { rules: ["nope"] })).rejects.toThrow(/unknown rule/);
  });

  it("definition.execute ok/fail tipizzato", async () => {
    const ctx = createContext(tmp);
    const res = await reviewerDefinition.execute({ args: { paths: ["bad.ts"], useDiagnose: false }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("review_code");
    const bad = await reviewerDefinition.execute({ args: { paths: ["../escape"] }, ctx });
    expect(bad.ok).toBe(false);
    expect(bad.error?.code).toBe("PATH_TRAVERSAL");
  });
});
