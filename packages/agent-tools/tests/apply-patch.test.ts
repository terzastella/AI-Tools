import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { applyPatchLogic } from "../src/tools/apply-patch/logic.js";
import { applyPatchDefinition } from "../src/tools/apply-patch/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-patch-"));
  await fs.writeFile(path.join(tmp, "a.txt"), "line1\nline2\nline3\n", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const PATCH = `--- a/a.txt
+++ b/a.txt
@@ -1,3 +1,3 @@
 line1
-line2
+LINE2
 line3
`;

describe("apply_patch", () => {
  it("dryRun non scrive", async () => {
    const ctx = createContext(tmp);
    const out = await applyPatchLogic(ctx, { patch: PATCH, dryRun: true });
    expect(out.dryRun).toBe(true);
    expect(out.files[0]!.added).toBe(1);
    expect(await fs.readFile(path.join(tmp, "a.txt"), "utf8")).toContain("line2");
  });

  it("applica davvero", async () => {
    const ctx = createContext(tmp);
    await applyPatchLogic(ctx, { patch: PATCH });
    expect(await fs.readFile(path.join(tmp, "a.txt"), "utf8")).toContain("LINE2");
  });

  it("multi-hunk", async () => {
    const ctx = createContext(tmp);
    await fs.writeFile(path.join(tmp, "m.txt"), "1\n2\n3\n4\n5\n6\n", "utf8");
    const p = `--- a/m.txt
+++ b/m.txt
@@ -1,3 +1,3 @@
-1
+ONE
 2
 3
@@ -4,3 +4,3 @@
 4
 5
-6
+SIX
`;
    const out = await applyPatchLogic(ctx, { patch: p });
    expect(out.files[0]!.hunks).toBe(2);
  });

  it("context mismatch -> errore", async () => {
    const ctx = createContext(tmp);
    const bad = PATCH.replace("line1", "WRONG");
    await expect(applyPatchLogic(ctx, { patch: bad })).rejects.toThrow(/mismatch/);
  });

  it("traversal e patch vuota", async () => {
    const ctx = createContext(tmp);
    await expect(applyPatchLogic(ctx, { patch: "  " })).rejects.toThrow(/required/);
    const evil = PATCH.replace("a/a.txt", "a/../escape.txt").replace("b/a.txt", "b/../escape.txt");
    await expect(applyPatchLogic(ctx, { patch: evil })).rejects.toThrow(/escapes/);
  });

  it("definition ok/fail", async () => {
    const ctx = createContext(tmp);
    const res = await applyPatchDefinition.execute({ args: { patch: PATCH, dryRun: true }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("apply_patch");
    const bad = await applyPatchDefinition.execute({ args: { patch: "nope" }, ctx });
    expect(bad.ok).toBe(false);
  });
});
