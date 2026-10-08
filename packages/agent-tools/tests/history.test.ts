import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { historyLogic } from "../src/tools/history/logic.js";
import { historyDefinition } from "../src/tools/history/definition.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-hist-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src/a.txt"), "v1", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("history", () => {
  it("record -> list -> restore", async () => {
    const ctx = createContext(tmp);
    const r = await historyLogic(ctx, { action: "record", path: "src/a.txt" });
    expect(r.versions.length).toBe(1);
    await fs.writeFile(path.join(tmp, "src/a.txt"), "v2", "utf8");
    const l = await historyLogic(ctx, { action: "list", path: "src/a.txt" });
    expect(l.versions.length).toBe(1);
    const out = await historyLogic(ctx, { action: "restore", path: "src/a.txt", versionId: l.versions[0]!.versionId });
    expect(out.restored).toBe("src/a.txt");
    expect(await fs.readFile(path.join(tmp, "src/a.txt"), "utf8")).toBe("v1");
  });

  it("restore versione inesistente e traversal", async () => {
    const ctx = createContext(tmp);
    await expect(historyLogic(ctx, { action: "restore", path: "src/a.txt", versionId: "nope" })).rejects.toThrow(
      /not found/,
    );
    await expect(historyLogic(ctx, { action: "record", path: "../escape" })).rejects.toThrow(/escapes/);
  });

  it("definition ok", async () => {
    const ctx = createContext(tmp);
    const res = await historyDefinition.execute({ args: { action: "record", path: "src/a.txt" }, ctx });
    expect(res.ok).toBe(true);
    expect(res.meta.tool).toBe("history");
  });
});
