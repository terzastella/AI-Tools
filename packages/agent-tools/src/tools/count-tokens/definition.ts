import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { countTokensLogic, COUNT_TOKENS_VERSION, type CountTokensInput, type CountTokensOutput } from "./logic.js";
import { countTokensPermissions } from "./permissions.js";

export const countTokensDefinition: ToolDefinition<CountTokensInput, CountTokensOutput> = {
  name: "count_tokens",
  label: "Count tokens",
  description: "Conta chars/parole/righe e stima token come chars//4 (euristica). Puro, non tocca disco. Port nativo di token_count.py.",
  category: "other",
  parameters: {
    type: "object",
    properties: { text: { type: "string", description: "Testo da misurare, max 500k chars" } },
    required: ["text"],
    additionalProperties: false,
  },
  permissions: countTokensPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: COUNT_TOKENS_VERSION, since: "0.11.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<CountTokensOutput>> {
    return withTiming("count_tokens", COUNT_TOKENS_VERSION, () => countTokensLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "COUNT_FAILED", message: err.message ?? String(e) };
    });
  },
};
