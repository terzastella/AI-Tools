import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { formatCheckLogic } from "../src/tools/format-check/logic.js";
import { formatCheckDefinition } from "../src/tools/format-check/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-fmt-"));
  await fs.writeFile(path.join(tmp, "a.txt"), "hello   \n\tindented\n\n\nworld", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("format_check", () => {
  it("trova spazi finali, tab e doppie vuote", async () => {
    const ctx = createContext(tmp);
    const out = await formatCheckLogic(ctx, { paths: ["."] });
    expect(out.issues.some((i) => i.rule === "trailing-space" && i.line === 1)).toBe(true);
    expect(out.issues.some((i) => i.rule === "tab-indent" && i.line === 2)).toBe(true);
    expect(out.issues.some((i) => i.rule === "double-blank")).toBe(true);
    expect(out.issues.some((i) => i.rule === "missing-eof-newline")).toBe(true);
  });

  it("definition ok/fail", async () => {
    const ctx = createContext(tmp);
    const res = await formatCheckDefinition.execute({ args: { paths: ["."] }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("format_check");
    const bad = await formatCheckDefinition.execute({ args: { paths: ["../escape"] }, ctx });
    expect(bad.ok).toBe(false);
  });
});
