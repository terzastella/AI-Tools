import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { toolkitDefinitions, TOOLKIT_CORE_NAMES } from "../src/toolkit.js";

const CATALOG = path.resolve(process.cwd(), "..", "..", "catalog", "tools.json");
const PKG = path.resolve(process.cwd(), "package.json");

describe("catalog-coerenza", () => {
  it("catalog.tools e levels.core corrispondono al codice", async () => {
    const catalog = JSON.parse(await fs.readFile(CATALOG, "utf8")) as {
      version: string;
      tools: string[];
      levels: { core: string[] };
    };
    const names = toolkitDefinitions.map((d) => d.name).sort();
    expect([...catalog.tools].sort()).toEqual(names);
    expect([...catalog.levels.core].sort()).toEqual([...TOOLKIT_CORE_NAMES].sort());
    const pkg = JSON.parse(await fs.readFile(PKG, "utf8")) as { version: string };
    expect(catalog.version).toBe(pkg.version);
  });
});
