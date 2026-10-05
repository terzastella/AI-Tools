import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { debuggerLogic, DEBUGGER_VERSION, type DebuggerInput, type DebuggerOutput } from "./logic.js";
import { debuggerPermissions } from "./permissions.js";

export const debuggerDefinition: ToolDefinition<DebuggerInput, DebuggerOutput> = {
  name: "debug_error",
  label: "Debug error",
  description: "Trova l'errore vero: stack verificato (file esiste) + tsc reale via diagnose. Niente indovinelli: se non trova, dice NO_CANDIDATE.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      errorLog: { type: "string" },
      paths: { type: "array" },
      maxCandidates: { type: "number" },
      applyFix: { type: "boolean" },
      backup: { type: "boolean" },
    },
    required: ["errorLog"],
    additionalProperties: false,
  },
  permissions: debuggerPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: DEBUGGER_VERSION, since: "0.4.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<DebuggerOutput>> {
    return withTiming("debug_error", DEBUGGER_VERSION, () => debuggerLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "DEBUGGER_FAILED", message: err.message ?? String(e) };
    });
  },
};
