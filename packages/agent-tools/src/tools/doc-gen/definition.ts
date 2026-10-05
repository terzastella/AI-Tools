import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { docGenLogic, DOC_GEN_VERSION, type GenerateDocsInput, type GenerateDocsOutput } from "./logic.js";
import { docGenPermissions } from "./permissions.js";

export const docGenDefinition: ToolDefinition<GenerateDocsInput, GenerateDocsOutput> = {
  name: "generate_docs",
  label: "Generate docs",
  description: "Genera documentazione markdown/jsdoc da codice: exports, funzioni, snippet. Read-only, compone prepare_context.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      paths: { type: "array" },
      maxFiles: { type: "number" },
      style: { type: "string", enum: ["markdown", "jsdoc"] },
      includePrivate: { type: "boolean" },
    },
    required: [],
    additionalProperties: false,
  },
  permissions: docGenPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: DOC_GEN_VERSION, since: "0.6.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<GenerateDocsOutput>> {
    return withTiming("generate_docs", DOC_GEN_VERSION, () => docGenLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "DOCGEN_FAILED", message: err.message ?? String(e) };
    });
  },
};
