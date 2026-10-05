import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { readLogic } from "../src/tools/read/logic.js";
import { readDefinition } from "../src/tools/read/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-read-"));
  await fs.writeFile(path.join(tmp, "a.txt"), "r1\nr2\nr3\nr4\nr5\n", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("read_file", () => {
  it("legge pezzo giusto", async () => {
    const ctx = createContext(tmp);
    const out = await readLogic(ctx, { path: "a.txt", offset: 2, limit: 2 });
    expect(out.lines).toEqual(["r2", "r3"]);
    expect(out.totalLines).toBe(6); // split su \n finale
    expect(out.truncated).toBe(true);
  });

  it("offset oltre fine = vuoto", async () => {
    const ctx = createContext(tmp);
    const out = await readLogic(ctx, { path: "a.txt", offset: 99 });
    expect(out.lines).toEqual([]);
  });

  it("blocca traversal e mancante", async () => {
    const ctx = createContext(tmp);
    await expect(readLogic(ctx, { path: "../escape.txt" })).rejects.toThrow(/escapes/);
    await expect(readLogic(ctx, { path: "nope.txt" })).rejects.toThrow(/not found/);
  });

  it("numeri strani", async () => {
    const ctx = createContext(tmp);
    await expect(readLogic(ctx, { path: "a.txt", offset: 0 })).rejects.toThrow(/offset/);
    await expect(readLogic(ctx, { path: "a.txt", limit: 2000 })).rejects.toThrow(/limit/);
  });

  it("definition ok/fail", async () => {
    const ctx = createContext(tmp);
    const res = await readDefinition.execute({ args: { path: "a.txt", limit: 2 }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("read_file");
    const bad = await readDefinition.execute({ args: { path: "../escape.txt" }, ctx });
    expect(bad.ok).toBe(false);
    expect(bad.error?.code).toBe("PATH_TRAVERSAL");
  });
});
