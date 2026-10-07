import { describe, it, expect } from "vitest";
import { toolkitDefinitions } from "../src/toolkit.js";
import { secureDefinitions } from "../examples/secure-register.js";
import { createContext } from "../src/core/context.js";

describe("toolkit", () => {
  it("espone 52 definition uniche", () => {
    expect(toolkitDefinitions.length).toBe(52);
    const names = toolkitDefinitions.map((d) => d.name);
    expect(new Set(names).size).toBe(52);
  });

  it("stesse del secure-register", () => {
    const secured = secureDefinitions(process.cwd()).map((d) => (d as { name: string }).name).sort();
    const plain = toolkitDefinitions.map((d) => d.name).sort();
    expect(secured).toEqual(plain);
  });

  it("ogni definition ha schema valido minimo", () => {
    const ctx = createContext(process.cwd());
    void ctx;
    for (const d of toolkitDefinitions) {
      expect(d.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(d.parameters.type).toBe("object");
      expect(typeof d.execute).toBe("function");
    }
  });
});
