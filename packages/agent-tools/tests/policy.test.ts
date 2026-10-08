import { describe, it, expect } from "vitest";
import {
  checkPolicy,
  matchTargetGlob,
  readonlyPolicy,
  standardPolicy,
  strictPolicy,
  extractTargets,
} from "../src/core/policy.js";

describe("policy", () => {
  it("deny vince su allow", async () => {
    const p = {
      allow: [{ domain: "filesystem", action: "write" as const }],
      deny: [{ domain: "filesystem", action: "write" as const }],
    };
    expect(checkPolicy(p, { domain: "filesystem", action: "write" }).allow).toBe(false);
  });

  it("fail-closed senza allow", async () => {
    expect(checkPolicy({ allow: [], deny: [] }, { domain: "filesystem", action: "write" }).allow).toBe(false);
  });

  it("standard permette src/** e nega .env", async () => {
    expect(checkPolicy(standardPolicy, { domain: "filesystem", action: "write" }, "src/a.ts").allow).toBe(true);
    expect(checkPolicy(standardPolicy, { domain: "filesystem", action: "write" }, ".env").allow).toBe(false);
    expect(checkPolicy(standardPolicy, { domain: "filesystem", action: "write" }, "node_modules/x.js").allow).toBe(
      false,
    );
  });

  it("standard nega write fuori scope", async () => {
    expect(checkPolicy(standardPolicy, { domain: "filesystem", action: "write" }, "random/out.txt").allow).toBe(false);
  });

  it("readonly e strict bloccano write", async () => {
    expect(checkPolicy(readonlyPolicy, { domain: "filesystem", action: "write" }).allow).toBe(false);
    expect(checkPolicy(strictPolicy, { domain: "filesystem", action: "write" }).allow).toBe(false);
    expect(checkPolicy(readonlyPolicy, { domain: "filesystem", action: "read" }).allow).toBe(true);
  });

  it("read sempre allow in standard", async () => {
    expect(checkPolicy(standardPolicy, { domain: "filesystem", action: "read" }).allow).toBe(true);
  });

  it("glob matching", async () => {
    expect(matchTargetGlob("src/a/b.ts", "src/**")).toBe(true);
    expect(matchTargetGlob(".tmp-x/f.txt", ".tmp-*/**")).toBe(true);
    expect(matchTargetGlob("other/f.txt", "src/**")).toBe(false);
  });

  it("extractTargets da path/paths", async () => {
    expect(extractTargets({ path: "src/a.ts" })).toEqual(["src/a.ts"]);
    expect(extractTargets({ paths: ["src", "docs"] })).toEqual(["src", "docs"]);
    expect(extractTargets({})).toEqual([]);
  });
});
