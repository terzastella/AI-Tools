import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { formatCheckLogic, FORMAT_CHECK_VERSION, type FormatCheckInput, type FormatCheckOutput } from "./logic.js";
import { formatCheckPermissions } from "./permissions.js";

export const formatCheckDefinition: ToolDefinition<FormatCheckInput, FormatCheckOutput> = {
  name: "format_check",
  label: "Format check",
  description:
    "Controlla solo formattazione meccanica (spazi finali, tab, EOL, newline finale). Solo lettura, niente fix.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      paths: { type: "array", description: "Default ['.']" },
      maxFiles: { type: "number", description: "1..100, default 20" },
      rules: {
        type: "array",
        description: "Subset di trailing-space, tab-indent, mixed-eol, missing-eof-newline, double-blank",
      },
    },
    required: [],
    additionalProperties: false,
  },
  permissions: formatCheckPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: FORMAT_CHECK_VERSION, since: "0.10.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<FormatCheckOutput>> {
    return withTiming(
      "format_check",
      FORMAT_CHECK_VERSION,
      () => formatCheckLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "FORMAT_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
