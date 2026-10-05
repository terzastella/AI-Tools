import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { gitLogic, GIT_VERSION, type GitInput, type GitOutput } from "./logic.js";
import { gitPermissions } from "./permissions.js";

export const gitDefinition: ToolDefinition<GitInput, GitOutput> = {
  name: "git",
  label: "Git read-only",
  description: "Foto prima/dopo: status, diff, log, branch, blame, staged. Solo leggere, non committa.",
  category: "git",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["status", "diff", "log", "branch", "blame", "staged"] },
      path: { type: "string" },
      maxLines: { type: "number" },
      line: { type: "number", description: "Riga per blame" },
    },
    required: [],
    additionalProperties: false,
  },
  permissions: gitPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: GIT_VERSION, since: "0.8.8" },
  async execute({ args, ctx }): Promise<AgentToolResult<GitOutput>> {
    return withTiming("git", GIT_VERSION, () => gitLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "GIT_FAILED", message: err.message ?? String(e) };
    });
  },
};
