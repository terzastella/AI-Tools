import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { debuggerLogic } from "../src/tools/debugger/logic.js";
import { debuggerDefinition } from "../src/tools/debugger/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-dbg-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src/writer.ts"), "export function writerLogic() {}\n", "utf8");
  await fs.writeFile(path.join(tmp, "src/editor.ts"), "export function editorLogic() {}\n", "utf8");
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

describe("debugger debug_error v1.1 deterministico", () => {
  it("stack verificato: trova file che esiste con verified:true", async () => {
    const ctx = createContext(tmp);
    const out = await debuggerLogic(ctx, {
      errorLog: "Error: boom\n at writerLogic (src/writer.ts:1:10)",
      paths: ["src"],
    });
    expect(out.candidates.length).toBeGreaterThan(0);
    expect(out.candidates[0]!.path).toContain("writer");
    expect(out.candidates[0]!.verified).toBe(true);
    expect(out.diagnosis).toContain("Trovato in");
  });

  it("tsc reale senza stack: usa errori veri", async () => {
    const ctx = createContext(tmp);
    await fs.writeFile(path.join(tmp, "src/broken.ts"), "export const z: number = 'oops';\n", "utf8");
    const out = await debuggerLogic(ctx, {
      errorLog: "Type 'string' is not assignable to type 'number'",
      paths: ["src"],
    });
    expect(out.candidates.length).toBeGreaterThan(0);
    expect(out.candidates[0]!.verified).toBe(true);
  });

  it("niente stack e tsc pulito: NO_CANDIDATE chiaro, non indovina", async () => {
    const ctx = createContext(tmp);
    await expect(debuggerLogic(ctx, { errorLog: "qualcosa di vago senza file", paths: ["src"] })).rejects.toThrow(
      /NO_CANDIDATE/,
    );
  });

  it("hint per AMBIGUOUS noto (deterministico)", async () => {
    const ctx = createContext(tmp);
    const out = await debuggerLogic(ctx, { errorLog: "oldString matches 2 times (use replaceAll:true)" });
    expect(out.patchPreview).toContain("replaceAll");
  });

  it("applyFix:true fa verifica reviewer", async () => {
    const ctx = createContext(tmp);
    const out = await debuggerLogic(ctx, { errorLog: "Error at src/writer.ts:1", paths: ["src"], applyFix: true });
    expect(out.verification).toBeDefined();
    expect(out.applied).toBeUndefined();
  });

  it("errorLog vuoto e traversal", async () => {
    const ctx = createContext(tmp);
    await expect(debuggerLogic(ctx, { errorLog: "  " })).rejects.toThrow(/errorLog/);
    await expect(debuggerLogic(ctx, { errorLog: "x", paths: ["../escape"] })).rejects.toThrow(/escapes/);
  });

  it("definition ok/fail", async () => {
    const ctx = createContext(tmp);
    const res = await debuggerDefinition.execute({ args: { errorLog: "boom at src/editor.ts:1" }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("debug_error");
    const bad = await debuggerDefinition.execute({ args: { errorLog: "  " }, ctx });
    expect(bad.ok).toBe(false);
    expect(bad.error?.code).toBe("BAD_ARGS");
  });
});
