import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { writerLogic } from "../src/tools/writer/logic.js";
import { writerDefinition } from "../src/tools/writer/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-writer-"));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("writer create_file", () => {
  it("crea file + mkdirs + atomico", async () => {
    const ctx = createContext(tmp);
    const out = await writerLogic(ctx, { path: "a/b/hello.txt", content: "ciao" });
    expect(out.created).toBe(true);
    expect(await fs.readFile(path.join(tmp, "a/b/hello.txt"), "utf8")).toBe("ciao");
  });

  it("rifiuta overwrite senza flag", async () => {
    const ctx = createContext(tmp);
    await writerLogic(ctx, { path: "f.txt", content: "1" });
    await expect(writerLogic(ctx, { path: "f.txt", content: "2" })).rejects.toThrow(/exists/);
  });

  it("permette overwrite:true", async () => {
    const ctx = createContext(tmp);
    await writerLogic(ctx, { path: "f.txt", content: "1" });
    const out = await writerLogic(ctx, { path: "f.txt", content: "2", overwrite: true });
    expect(out.overwritten).toBe(true);
    expect(await fs.readFile(path.join(tmp, "f.txt"), "utf8")).toBe("2");
  });

  it("blocca traversal", async () => {
    const ctx = createContext(tmp);
    await expect(writerLogic(ctx, { path: "../escape.txt", content: "x" })).rejects.toThrow(/escapes/);
  });

  it("dryRun non scrive", async () => {
    const ctx = createContext(tmp);
    const out = await writerLogic(ctx, { path: "d.txt", content: "hi", dryRun: true });
    expect(out.dryRun).toBe(true);
    await expect(fs.stat(path.join(tmp, "d.txt"))).rejects.toBeTruthy();
  });

  it("definition.execute ritorna AgentToolResult ok", async () => {
    const ctx = createContext(tmp);
    const res = await writerDefinition.execute({ args: { path: "v.txt", content: "v" }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("create_file");
  });

  it("definition.execute mappa errori in fail (non throw)", async () => {
    const ctx = createContext(tmp);
    await writerLogic(ctx, { path: "e.txt", content: "1" });
    const res = await writerDefinition.execute({ args: { path: "e.txt", content: "2" }, ctx });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("EXISTS");
  });
});
