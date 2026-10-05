import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { editManyLogic } from "../src/tools/edit-many/logic.js";
import { editManyDefinition } from "../src/tools/edit-many/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-emany-"));
  await fs.writeFile(path.join(tmp, "a.txt"), "hello", "utf8");
  await fs.writeFile(path.join(tmp, "b.txt"), "world", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("edit_many", () => {
  it("applica tutto o niente", async () => {
    const ctx = createContext(tmp);
    const out = await editManyLogic(ctx, {
      edits: [
        { path: "a.txt", oldString: "hello", newString: "hi" },
        { path: "b.txt", oldString: "world", newString: "earth" },
      ],
    });
    expect(out.applied.length).toBe(2);
    expect(await fs.readFile(path.join(tmp, "a.txt"), "utf8")).toBe("hi");
  });

  it("se una voce fallisce non scrive nulla", async () => {
    const ctx = createContext(tmp);
    await expect(
      editManyLogic(ctx, {
        edits: [
          { path: "a.txt", oldString: "hello", newString: "hi" },
          { path: "b.txt", oldString: "MISSING", newString: "x" },
        ],
      }),
    ).rejects.toThrow(/not found/);
    expect(await fs.readFile(path.join(tmp, "a.txt"), "utf8")).toBe("hello");
  });

  it("dryRun non scrive e definition ok", async () => {
    const ctx = createContext(tmp);
    const res = await editManyDefinition.execute({
      args: { edits: [{ path: "a.txt", oldString: "hello", newString: "hi" }], dryRun: true },
      ctx,
    });
    expect(res.ok).toBe(true);
    expect(await fs.readFile(path.join(tmp, "a.txt"), "utf8")).toBe("hello");
  });
});
