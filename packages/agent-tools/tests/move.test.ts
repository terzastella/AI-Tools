import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { moveLogic } from "../src/tools/move/logic.js";
import { moveDefinition } from "../src/tools/move/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-move-"));
  await fs.writeFile(path.join(tmp, "a.txt"), "hello", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("move_file", () => {
  it("move sposta", async () => {
    const ctx = createContext(tmp);
    const out = await moveLogic(ctx, { op: "move", from: "a.txt", to: "b.txt" });
    expect(out.to).toBe("b.txt");
    expect(await fs.readFile(path.join(tmp, "b.txt"), "utf8")).toBe("hello");
    await expect(fs.stat(path.join(tmp, "a.txt"))).rejects.toBeTruthy();
  });

  it("copy duplica", async () => {
    const ctx = createContext(tmp);
    await moveLogic(ctx, { op: "copy", from: "a.txt", to: "c.txt" });
    expect(await fs.readFile(path.join(tmp, "c.txt"), "utf8")).toBe("hello");
    expect(await fs.readFile(path.join(tmp, "a.txt"), "utf8")).toBe("hello");
  });

  it("delete cancella", async () => {
    const ctx = createContext(tmp);
    await moveLogic(ctx, { op: "delete", from: "a.txt" });
    await expect(fs.stat(path.join(tmp, "a.txt"))).rejects.toBeTruthy();
  });

  it("rifiuta overwrite e traversal", async () => {
    const ctx = createContext(tmp);
    await fs.writeFile(path.join(tmp, "b.txt"), "x", "utf8");
    await expect(moveLogic(ctx, { op: "move", from: "a.txt", to: "b.txt" })).rejects.toThrow(/exists/);
    await expect(moveLogic(ctx, { op: "move", from: "../escape", to: "b.txt" })).rejects.toThrow(/escapes/);
  });

  it("definition ok", async () => {
    const ctx = createContext(tmp);
    const res = await moveDefinition.execute({ args: { op: "copy", from: "a.txt", to: "z.txt" }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("move_file");
  });
});
