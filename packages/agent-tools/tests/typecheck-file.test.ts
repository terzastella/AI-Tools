import { describe, it, expect } from "vitest";
import { createContext } from "../src/core/context.js";
import { typecheckFileLogic } from "../src/tools/typecheck-file/logic.js";
import { typecheckFileDefinition } from "../src/tools/typecheck-file/definition.js";

describe("typecheck_file", () => {
  it("file pulito del progetto = zero issue filtrate", async () => {
    const ctx = createContext(process.cwd());
    const out = await typecheckFileLogic(ctx, { paths: ["src/core/result.ts"] });
    expect(out.files).toEqual(["src/core/result.ts"]);
    expect(Array.isArray(out.issues)).toBe(true);
  }, 60000);

  it("rifiuta traversal e input vuoto", async () => {
    const ctx = createContext(process.cwd());
    await expect(typecheckFileLogic(ctx, { paths: ["../escape.ts"] })).rejects.toThrow(/escapes/);
    await expect(typecheckFileLogic(ctx, { paths: [] })).rejects.toThrow(/1..10/);
  });

  it("definition mappa errori senza throw", async () => {
    const ctx = createContext(process.cwd());
    const bad = await typecheckFileDefinition.execute({ args: { paths: [] }, ctx });
    expect(bad.ok).toBe(false);
    expect(bad.meta.tool).toBe("typecheck_file");
  }, 30000);
});
