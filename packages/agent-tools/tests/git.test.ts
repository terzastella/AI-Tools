import { describe, it, expect } from "vitest";
import { createContext } from "../src/core/context.js";
import { gitLogic } from "../src/tools/git/logic.js";
import { gitDefinition } from "../src/tools/git/definition.js";

describe("git read-only", () => {
  it("status o NOT_GIT ma non crash", async () => {
    const ctx = createContext(process.cwd());
    const res = await gitDefinition.execute({ args: { action: "status" }, ctx });
    // dentro structure/ non è detto sia repo git: accetta ok oppure NOT_GIT
    if (res.ok) expect(res.data?.action).toBe("status");
    else expect(res.error?.code).toMatch(/GIT_FAILED|NOT_GIT/);
  });

  it("traversal block e action invalida", async () => {
    const ctx = createContext(process.cwd());
    await expect(gitLogic(ctx, { path: "../escape" })).rejects.toThrow(/escapes/);
    // @ts-expect-error test invalido
    await expect(gitLogic(ctx, { action: "push" })).rejects.toThrow(/action/);
  });

  it("definition ok", async () => {
    const ctx = createContext(process.cwd());
    const res = await gitDefinition.execute({ args: { action: "log" }, ctx });
    expect(res.meta.tool).toBe("git");
  });
});
