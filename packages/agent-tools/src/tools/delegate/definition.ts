import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { delegateLogic, DELEGATE_VERSION, type DelegateInput, type DelegateOutput } from "./logic.js";
import { delegatePermissions } from "./permissions.js";

export const delegateDefinition: ToolDefinition<DelegateInput, DelegateOutput> = {
  name: "delegate_task",
  label: "Delegate task",
  description: "Capo-cantiere read-only: fa piano furbo, registra todo in .agent/todos.json, verifica ogni file (leggibile + puzze). Non scrive codice, propone.",
  category: "other",
  parameters: {
    type: "object",
    properties: { goal: { type: "string" }, paths: { type: "array" }, maxSteps: { type: "number" } },
    required: ["goal"],
    additionalProperties: false,
  },
  permissions: delegatePermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: DELEGATE_VERSION, since: "0.9.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<DelegateOutput>> {
    return withTiming("delegate_task", DELEGATE_VERSION, () => delegateLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "DELEGATE_FAILED", message: err.message ?? String(e) };
    });
  },
};
