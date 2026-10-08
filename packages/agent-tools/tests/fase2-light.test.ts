import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { inspectSymbolLogic } from "../src/tools/inspect-symbol/logic.js";
import { importMapLogic } from "../src/tools/import-map/logic.js";
import { checkConfigLogic } from "../src/tools/check-config/logic.js";
import { askUserLogic } from "../src/tools/ask-user/logic.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-f2-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src/a.ts"), "export function hello(name: string) {\n return name;\n}\n", "utf8");
  await fs.writeFile(path.join(tmp, "src/b.ts"), 'import { hello } from "./a";\nconsole.log(hello);\n', "utf8");
  await fs.writeFile(
    path.join(tmp, "package.json"),
    JSON.stringify({ name: "x", scripts: {}, engines: { node: ">=20" } }),
    "utf8",
  );
  await fs.writeFile(path.join(tmp, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true } }), "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("fase2 leggeri", () => {
  it("inspect_symbol trova definizione e tipo", async () => {
    const ctx = createContext(tmp);
    const out = await inspectSymbolLogic(ctx, { symbol: "hello", path: "src/a.ts" });
    expect(out.definitionLine).toBe(1);
    expect(out.typeHint ?? "").toContain("string");
  });

  it("import_map mappa b->a", async () => {
    const ctx = createContext(tmp);
    const out = await importMapLogic(ctx, { paths: ["src"] });
    const b = out.nodes.find((n) => n.path === "src/b.ts");
    expect(b?.imports.some((i) => i.includes("src/a"))).toBe(true);
  });

  it("check_config ok senza issue", async () => {
    const ctx = createContext(tmp);
    const out = await checkConfigLogic(ctx, { paths: ["."] });
    expect(out.checked).toBe(2);
    expect(out.issues.length).toBe(0);
  });

  it("ask_user valida opzioni", async () => {
    const ctx = createContext(tmp);
    const out = await askUserLogic(ctx, { question: "A o B?", options: [{ label: "A" }, { label: "B" }] });
    expect(out.options.length).toBe(2);
    await expect(askUserLogic(ctx, { question: "x", options: [{ label: "solo" }] })).rejects.toThrow();
  });
});
