import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { bashExecLogic, BASH_EXEC_VERSION, type BashExecInput, type BashExecOutput } from "./logic.js";
import { bashExecPermissions } from "./permissions.js";

export const bashExecDefinition: ToolDefinition<BashExecInput, BashExecOutput> = {
  name: "bash_exec",
  label: "Bash exec",
  description: "Esegue un binario senza shell (execFile): cmd + args[], workdir dentro cwd, timeout 5..120s. Chiede sempre accept umano, blocca comandi pericolosi.",
  category: "terminal",
  parameters: {
    type: "object",
    properties: {
      cmd: { type: "string", description: "Binario singolo, es. node, npm, python. Niente spazi, niente shell." },
      args: { type: "array", description: "Max 50 stringhe" },
      workdir: { type: "string", description: "Subcartella dentro cwd, default cwd" },
      timeoutMs: { type: "number", description: "5000..120000, default 30000" },
    },
    required: ["cmd"],
    additionalProperties: false,
  },
  permissions: bashExecPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: BASH_EXEC_VERSION, since: "0.11.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<BashExecOutput>> {
    return withTiming("bash_exec", BASH_EXEC_VERSION, () => bashExecLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "EXEC_FAILED", message: err.message ?? String(e) };
    });
  },
};
