import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { gitWriteLogic, GIT_WRITE_VERSION, type GitWriteInput, type GitWriteOutput } from "./logic.js";
import { gitWritePermissions } from "./permissions.js";

export const gitWriteDefinition: ToolDefinition<GitWriteInput, GitWriteOutput> = {
  name: "git_write",
  label: "Git write",
  description:
    "Scrive sul repo locale: add, commit, branch, checkout, stash. Mai push/fetch (li fai tu dall'App). Serve sempre accept umano.",
  category: "git",
  parameters: {
    type: "object",
    properties: {
      op: { type: "string", enum: ["add", "commit", "branch", "checkout", "stash"] },
      files: { type: "array", description: "Path dentro cwd, max 50" },
      msg: { type: "string", description: "Per commit/stash" },
      branch: { type: "string", description: "Per branch/checkout" },
      create: { type: "boolean", description: "checkout -b" },
      timeoutMs: { type: "number", description: "5000..120000, default 30000" },
    },
    required: ["op"],
    additionalProperties: false,
  },
  permissions: gitWritePermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: GIT_WRITE_VERSION, since: "0.13.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<GitWriteOutput>> {
    return withTiming(
      "git_write",
      GIT_WRITE_VERSION,
      () => gitWriteLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "GIT_WRITE_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
