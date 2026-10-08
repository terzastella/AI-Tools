import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { skillCreatorLogic, SKILL_CREATOR_VERSION, type SkillCreatorInput, type SkillCreatorOutput } from "./logic.js";
import { skillCreatorPermissions } from "./permissions.js";

export const skillCreatorDefinition: ToolDefinition<SkillCreatorInput, SkillCreatorOutput> = {
  name: "create_skill",
  label: "Create skill",
  description:
    "Meta-tool: genera scaffold di un nuovo ToolDefinition (logic+definition+permissions+index+test stub) conforme al core. Default dry-run, write:true per scrivere.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "snake_case, es. summarize_code" },
      description: { type: "string" },
      label: { type: "string" },
      category: { type: "string" },
      write: { type: "boolean" },
      dir: { type: "string" },
    },
    required: ["name", "description"],
    additionalProperties: false,
  },
  permissions: skillCreatorPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: SKILL_CREATOR_VERSION, since: "0.5.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<SkillCreatorOutput>> {
    return withTiming(
      "create_skill",
      SKILL_CREATOR_VERSION,
      () => skillCreatorLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "SKILL_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
