import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

const TOOLS_DIR = path.resolve(process.cwd(), "src", "tools");
const DOCS_DIR = path.resolve(process.cwd(), "docs", "tools");

describe("docs-coverage", () => {
  it("ogni tool ha la sua pagina docs (nome dir == nome doc)", async () => {
    const dirs = (await fs.readdir(TOOLS_DIR, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    const docs = (await fs.readdir(DOCS_DIR))
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.slice(0, -3))
      .sort();
    expect(dirs.length).toBeGreaterThan(0);
    expect(docs).toEqual(dirs);
  });
});
