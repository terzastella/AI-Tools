import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { todoLogic } from "../src/tools/todo/logic.js";
import { todoDefinition } from "../src/tools/todo/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-todo-"));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("todo", () => {
  it("add + list + complete + clear", async () => {
    const ctx = createContext(tmp);
    const added = await todoLogic(ctx, { action: "add", text: "fare X" });
    expect(added.todos.length).toBe(1);
    const id = added.todos[0]!.id;
    const listed = await todoLogic(ctx, { action: "list" });
    expect(listed.todos.length).toBe(1);
    await todoLogic(ctx, { action: "complete", id });
    const cleared = await todoLogic(ctx, { action: "clear" });
    expect(cleared.todos.length).toBe(0);
  });

  it("add senza testo e complete ignoto", async () => {
    const ctx = createContext(tmp);
    await expect(todoLogic(ctx, { action: "add", text: "  " })).rejects.toThrow(/text/);
    await expect(todoLogic(ctx, { action: "complete", id: "nope" })).rejects.toThrow(/not found/);
  });

  it("definition ok", async () => {
    const ctx = createContext(tmp);
    const res = await todoDefinition.execute({ args: { action: "add", text: "hello" }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("todo");
  });
});
