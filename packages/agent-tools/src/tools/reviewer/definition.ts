import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { reviewerLogic, REVIEWER_VERSION, type ReviewerInput, type ReviewerOutput } from "./logic.js";
import { reviewerPermissions } from "./permissions.js";

export const reviewerDefinition: ToolDefinition<ReviewerInput, ReviewerOutput> = {
  name: "review_code",
  label: "Review code",
  description:
    "Review con dottore dentro (default acceso): stile + errori tsc-error veri via diagnose. Output severity/path/line.",
  category: "search",
  parameters: {
    type: "object",
    properties: {
      paths: { type: "array" },
      includeGlobs: { type: "array" },
      excludeGlobs: { type: "array" },
      maxFiles: { type: "number" },
      rules: { type: "array" },
      useDiagnose: { type: "boolean", description: "Default true: aggiunge errori tsc-error veri" },
    },
    required: [],
    additionalProperties: false,
  },
  permissions: reviewerPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: REVIEWER_VERSION, since: "0.3.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<ReviewerOutput>> {
    return withTiming(
      "review_code",
      REVIEWER_VERSION,
      () => reviewerLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "REVIEWER_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
