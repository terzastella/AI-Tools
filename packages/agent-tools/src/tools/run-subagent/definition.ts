import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { runSubagentLogic, RUN_SUBAGENT_VERSION, type RunSubagentInput, type RunSubagentOutput } from "./logic.js";
import { runSubagentPermissions } from "./permissions.js";

export const runSubagentDefinition: ToolDefinition<RunSubagentInput, RunSubagentOutput> = {
  name: "run_subagent",
  label: "Run subagent",
  description: "Sub-agent vero con contesto isolato: gli passi goal + path, lui ragiona sul modello (default Ollama locale) e torna il risultato. delegate_task invece è solo planning.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      goal: { type: "string" },
      paths: { type: "array", description: "Max 20, contesto max 8k chars" },
      provider: { type: "string", enum: ["ollama", "echo"] },
      model: { type: "string", description: "Default llama3.1 / OLLAMA_MODEL" },
      system: { type: "string" },
      timeoutMs: { type: "number", description: "10000..300000, default 120000" },
    },
    required: ["goal"],
    additionalProperties: false,
  },
  permissions: runSubagentPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: RUN_SUBAGENT_VERSION, since: "0.16.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<RunSubagentOutput>> {
    return withTiming("run_subagent", RUN_SUBAGENT_VERSION, () => runSubagentLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "SUBAGENT_FAILED", message: err.message ?? String(e) };
    });
  },
};
