import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { editorLogic } from "../src/tools/editor/logic.js";
import { editorDefinition } from "../src/tools/editor/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-editor-"));
  await fs.writeFile(path.join(tmp, "code.txt"), "line1\nline2\nline2\nline3\n", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("editor edit_file", () => {
  it("replace singolo ok", async () => {
    const ctx = createContext(tmp);
    await fs.writeFile(path.join(tmp, "s.txt"), "hello world", "utf8");
    const out = await editorLogic(ctx, { path: "s.txt", oldString: "world", newString: "there" });
    expect(out.replacements).toBe(1);
    expect(await fs.readFile(path.join(tmp, "s.txt"), "utf8")).toBe("hello there");
  });

  it("rifiuta ambiguo senza replaceAll", async () => {
    const ctx = createContext(tmp);
    await expect(editorLogic(ctx, { path: "code.txt", oldString: "line2", newString: "X" })).rejects.toThrow(
      /matches 2/,
    );
  });

  it("replaceAll ok", async () => {
    const ctx = createContext(tmp);
    const out = await editorLogic(ctx, { path: "code.txt", oldString: "line2", newString: "X", replaceAll: true });
    expect(out.replacements).toBe(2);
  });

  it("oldString non trovato", async () => {
    const ctx = createContext(tmp);
    await expect(editorLogic(ctx, { path: "code.txt", oldString: "zzz", newString: "X" })).rejects.toThrow(/not found/);
  });

  it("insertAt linea 2", async () => {
    const ctx = createContext(tmp);
    await editorLogic(ctx, { path: "code.txt", mode: "insertAt", line: 2, content: "INSERTED" });
    const content = await fs.readFile(path.join(tmp, "code.txt"), "utf8");
    expect(content.split("\n")[1]).toBe("INSERTED");
  });

  it("deleteRange 2-3", async () => {
    const ctx = createContext(tmp);
    await editorLogic(ctx, { path: "code.txt", mode: "deleteRange", startLine: 2, endLine: 3 });
    const content = await fs.readFile(path.join(tmp, "code.txt"), "utf8");
    expect(content).toBe("line1\nline3\n");
  });

  it("backup crea .bak", async () => {
    const ctx = createContext(tmp);
    await fs.writeFile(path.join(tmp, "b.txt"), "orig", "utf8");
    const out = await editorLogic(ctx, { path: "b.txt", oldString: "orig", newString: "new", backup: true });
    expect(out.backupPath).toBeDefined();
    expect(await fs.readFile(out.backupPath!, "utf8")).toBe("orig");
  });

  it("definition.execute fail tipizzato, non throw", async () => {
    const ctx = createContext(tmp);
    const res = await editorDefinition.execute({ args: { path: "code.txt", oldString: "line2", newString: "X" }, ctx });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("AMBIGUOUS");
  });
});
