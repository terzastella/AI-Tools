import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { findFilesLogic } from "../src/tools/find-files/logic.js";
import { findFilesDefinition } from "../src/tools/find-files/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-find-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src/a.ts"), "x", "utf8");
  await fs.writeFile(path.join(tmp, "src/b.test.ts"), "y", "utf8");
  await fs.mkdir(path.join(tmp, "node_modules"), { recursive: true });
  await fs.writeFile(path.join(tmp, "node_modules/skip.ts"), "z", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("find_files", () => {
  it("trova con jolly e salta node_modules", async () => {
    const ctx = createContext(tmp);
    const out = await findFilesLogic(ctx, { pattern: "src/**/*.ts" });
    expect(out.matches.some((m) => m.path === "src/a.ts")).toBe(true);
    expect(out.matches.some((m) => m.path.includes("node_modules"))).toBe(false);
  });

  it("blocca pattern assoluti e traversal", async () => {
    const ctx = createContext(tmp);
    await expect(findFilesLogic(ctx, { pattern: "../escape" })).rejects.toThrow();
    await expect(findFilesLogic(ctx, { pattern: "" })).rejects.toThrow();
  });

  it("definition ok/fail", async () => {
    const ctx = createContext(tmp);
    const res = await findFilesDefinition.execute({ args: { pattern: "*.ts", paths: ["src"] }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("find_files");
  });
});
