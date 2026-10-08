import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { askUserLogic, ASK_USER_VERSION, type AskUserInput, type AskUserOutput } from "./logic.js";
import { askUserPermissions } from "./permissions.js";

export const askUserDefinition: ToolDefinition<AskUserInput, AskUserOutput> = {
  name: "ask_user",
  label: "Ask user",
  description: "Ferma il robot e chiede all'umano con opzioni 2..6. Non tocca disco, l'agente mostra la UI.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      question: { type: "string" },
      options: { type: "array" },
      multi: { type: "boolean", description: "Default false" },
    },
    required: ["question", "options"],
    additionalProperties: false,
  },
  permissions: askUserPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: ASK_USER_VERSION, since: "0.10.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<AskUserOutput>> {
    return withTiming(
      "ask_user",
      ASK_USER_VERSION,
      () => askUserLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "ASK_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
