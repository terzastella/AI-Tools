import { bench, describe } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../../src/core/context.js";
import { writerLogic } from "../../src/tools/writer/logic.js";
import { editorLogic } from "../../src/tools/editor/logic.js";

describe("bench writer/editor (baseline v0.1)", () => {
  bench("writer 4KB", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-bw-"));
    const ctx = createContext(tmp);
    await writerLogic(ctx, { path: "f.txt", content: "x".repeat(4096) });
    await fs.rm(tmp, { recursive: true, force: true });
  });

  bench("editor replace 100 righe", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-be-"));
    const ctx = createContext(tmp);
    const big = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
    await writerLogic(ctx, { path: "big.txt", content: big });
    await editorLogic(ctx, { path: "big.txt", oldString: "line 50", newString: "CHANGED" });
    await fs.rm(tmp, { recursive: true, force: true });
  });
});
