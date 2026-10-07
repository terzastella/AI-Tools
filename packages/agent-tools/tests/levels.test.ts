import { describe, it, expect } from "vitest";
import { toolkitCore, TOOLKIT_CORE_NAMES, toolkitDefinitions } from "../src/toolkit.js";

describe("levels", () => {
  it("core sono 15 nomi stabili", () => {
    expect(TOOLKIT_CORE_NAMES.length).toBe(15);
    expect([...TOOLKIT_CORE_NAMES].sort()).toEqual([...TOOLKIT_CORE_NAMES].sort());
  });

  it("toolkitCore risolve tutti dal toolkit pieno", () => {
    expect(toolkitCore.length).toBe(15);
    const all = new Set(toolkitDefinitions.map((d) => d.name));
    for (const n of TOOLKIT_CORE_NAMES) expect(all.has(n)).toBe(true);
  });

  it("nomi core unici e snake_case", () => {
    expect(new Set(TOOLKIT_CORE_NAMES).size).toBe(15);
    for (const n of TOOLKIT_CORE_NAMES) expect(n).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});
