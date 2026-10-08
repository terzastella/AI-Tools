import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { findFilesLogic, FIND_FILES_VERSION, type FindFilesInput, type FindFilesOutput } from "./logic.js";
import { findFilesPermissions } from "./permissions.js";

export const findFilesDefinition: ToolDefinition<FindFilesInput, FindFilesOutput> = {
  name: "find_files",
  label: "Find files",
  description: "Trova file per nome con jolly (*, **, ?). Solo lettura, salta node_modules/dist/.git.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob relativo, es. src/**/*.test.ts" },
      paths: { type: "array", description: "Default ['.']" },
      maxFiles: { type: "number", description: "1..200, default 50" },
      includeHidden: { type: "boolean", description: "Default false" },
    },
    required: ["pattern"],
    additionalProperties: false,
  },
  permissions: findFilesPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: FIND_FILES_VERSION, since: "0.10.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<FindFilesOutput>> {
    return withTiming(
      "find_files",
      FIND_FILES_VERSION,
      () => findFilesLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "FIND_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
