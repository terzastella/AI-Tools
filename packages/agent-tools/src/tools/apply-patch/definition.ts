import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { applyPatchLogic, APPLY_PATCH_VERSION, type ApplyPatchInput, type ApplyPatchOutput } from "./logic.js";
import { applyPatchPermissions } from "./permissions.js";

export const applyPatchDefinition: ToolDefinition<ApplyPatchInput, ApplyPatchOutput> = {
  name: "apply_patch",
  label: "Apply patch",
  description:
    "Applica unified diff multi-file/multi-hunk con verifica contesto. Supporta dry-run. Non duplicato del core: edit_file fa single-string, questo fa patch.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      patch: { type: "string", description: "Unified diff, es. --- a/f +++ b/f @@ ..." },
      dryRun: { type: "boolean" },
      stripPrefix: { type: "number", description: "Default 1 (toglie a/ b/)" },
    },
    required: ["patch"],
    additionalProperties: false,
  },
  permissions: applyPatchPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: APPLY_PATCH_VERSION, since: "0.6.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<ApplyPatchOutput>> {
    return withTiming(
      "apply_patch",
      APPLY_PATCH_VERSION,
      () => applyPatchLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "PATCH_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
