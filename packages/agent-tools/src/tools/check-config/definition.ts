import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { checkConfigLogic, CHECK_CONFIG_VERSION, type CheckConfigInput, type CheckConfigOutput } from "./logic.js";
import { checkConfigPermissions } from "./permissions.js";

export const checkConfigDefinition: ToolDefinition<CheckConfigInput, CheckConfigOutput> = {
  name: "check_config",
  label: "Check config",
  description: "Controlla package.json e tsconfig.json con regole pure, senza eseguire nulla. Solo lettura.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      paths: { type: "array", description: "Default ['.']" },
    },
    required: [],
    additionalProperties: false,
  },
  permissions: checkConfigPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: CHECK_CONFIG_VERSION, since: "0.10.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<CheckConfigOutput>> {
    return withTiming(
      "check_config",
      CHECK_CONFIG_VERSION,
      () => checkConfigLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "CHECK_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
