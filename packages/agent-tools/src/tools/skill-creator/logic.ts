import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";
import { writerLogic } from "../writer/logic.js";
import type { ToolCategory } from "../../core/types.js";

export interface SkillCreatorInput {
  name: string;
  description: string;
  label?: string;
  category?: ToolCategory;
  write?: boolean;
  dir?: string;
}

export interface SkillFile {
  path: string;
  content: string;
}

export interface SkillCreatorOutput {
  name: string;
  files: SkillFile[];
  definitionSnippet: string;
  nextSteps: string[];
  written: boolean;
}

export const SKILL_CREATOR_VERSION = "1.0.0";
const SNAKE_RE = /^[a-z][a-z0-9_]*$/;
const EXISTING = new Set(["create_file", "edit_file", "prepare_context", "review_code", "debug_error", "create_skill"]);

function pascal(s: string): string {
  return s.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

export async function skillCreatorLogic(ctx: ToolContext, input: SkillCreatorInput): Promise<SkillCreatorOutput> {
  const name = (input.name ?? "").trim();
  const description = (input.description ?? "").trim();
  if (!SNAKE_RE.test(name)) throw Object.assign(new Error("name must be snake_case"), { code: "BAD_ARGS" });
  if (!description) throw Object.assign(new Error("description is required"), { code: "BAD_ARGS" });
  if (EXISTING.has(name)) throw Object.assign(new Error(`tool already exists: ${name}`), { code: "COLLISION" });
  const label = (input.label ?? name.replace(/_/g, " ")).trim() || name;
  const category: ToolCategory = input.category ?? "other";
  const write = input.write ?? false;
  const dir = (input.dir ?? "src/tools").trim() || "src/tools";

  const folder = name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()).replace(/_/g, "-");
  // folder kebab semplice: create_skill -> create-skill? mantieni snake per coerenza repo: usa name senza underscore? No: usa name così com'è.
  const baseDir = `${dir}/${name}`;
  const pascalName = pascal(name);
  const constName = `${name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}Definition`.replace(/^./, (c) => c.toLowerCase());
  const version = "1.0.0";

  const logicTs = `import type { ToolContext } from "../../core/context.js";

export interface ${pascalName}Input {
  input?: string;
}

export interface ${pascalName}Output {
  echo: string;
}

export const ${name.toUpperCase()}_VERSION = "${version}";

export async function ${name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}Logic(ctx: ToolContext, input: ${pascalName}Input): Promise<${pascalName}Output> {
  const echo = (input.input ?? "").trim();
  if (!echo) throw Object.assign(new Error("input is required"), { code: "BAD_ARGS" });
  ctx.logger.info("${name}", { echo: echo.slice(0, 80) });
  return { echo };
}
`;

  const definitionTs = `import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { ${name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}Logic, ${name.toUpperCase()}_VERSION, type ${pascalName}Input, type ${pascalName}Output } from "./logic.js";
import { ${name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}Permissions } from "./permissions.js";

export const ${constName}: ToolDefinition<${pascalName}Input, ${pascalName}Output> = {
  name: "${name}",
  label: "${label.replace(/"/g, "")}",
  description: "${description.replace(/"/g, "").slice(0, 200)}",
  category: "${category}",
  parameters: {
    type: "object",
    properties: { input: { type: "string" } },
    required: ["input"],
    additionalProperties: false,
  },
  permissions: ${name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}Permissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: ${name.toUpperCase()}_VERSION, since: "0.5.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<${pascalName}Output>> {
    return withTiming("${name}", ${name.toUpperCase()}_VERSION, () => ${name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}Logic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "SKILL_FAILED", message: err.message ?? String(e) };
    });
  },
};
`;

  const permissionsTs = `import type { PermissionRequirement } from "../../core/types.js";

export const ${name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}Permissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
`;

  const indexTs = `export * from "./logic.js";
export * from "./definition.js";
export * from "./permissions.js";
`;

  const testTs = `import { describe, it, expect } from "vitest";
import { createContext } from "../../src/core/context.js";
import { ${constName} } from "../../src/tools/${name}/definition.js";

describe("${name}", () => {
  it("execute ok/fail", async () => {
    const ctx = createContext(process.cwd());
    const res = await ${constName}.execute({ args: { input: "hello" }, ctx });
    expect(res.ok).toBe(true);
  });
});
`;

  const files: SkillFile[] = [
    { path: `${baseDir}/logic.ts`, content: logicTs },
    { path: `${baseDir}/definition.ts`, content: definitionTs },
    { path: `${baseDir}/permissions.ts`, content: permissionsTs },
    { path: `${baseDir}/index.ts`, content: indexTs },
  ];

  const definitionSnippet = `import { ${constName} } from "ai-toolkit/dist/tools/${name}/definition.js";\nregistry.register(${constName});`;
  const nextSteps = ["pnpm typecheck", "pnpm test", `registry.register(${constName})`];

  let written = false;
  if (write) {
    void folder;
    for (const f of files) {
      const r = resolveSafePath(ctx, f.path);
      if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${f.path}`), { code: "PATH_TRAVERSAL" });
    }
    // test stub non scritto su disco (solo docs) — scriviamo i 4 core
    for (const f of files) {
      await writerLogic(ctx, { path: f.path, content: f.content, overwrite: false, mkdirs: true });
    }
    // doc stub via writer
    await writerLogic(ctx, {
      path: `docs/tools/${name}.md`,
      content: `# ${name}\n\n${description}\n`,
      overwrite: false,
      mkdirs: true,
    });
    written = true;
    // aggiorna EXISTING runtime per sessione (non persistente)
    EXISTING.add(name);
  }

  // usa path per coerenza import
  void path;
  ctx.logger.info("create_skill", { name, written });
  return { name, files: write ? files : [...files, { path: `tests/${name}.test.ts`, content: testTs }], definitionSnippet, nextSteps, written };
}
