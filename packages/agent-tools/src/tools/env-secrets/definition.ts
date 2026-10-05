import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { envSecretsLogic, ENV_SECRETS_VERSION, type EnvSecretsInput, type EnvSecretsOutput } from "./logic.js";
import { envSecretsPermissions } from "./permissions.js";

export const envSecretsDefinition: ToolDefinition<EnvSecretsInput, EnvSecretsOutput> = {
  name: "env_secrets",
  label: "Env secrets",
  description: "Igiene secrets: check dice solo se una var è impostata (mai il valore), redact maschera i valori in un testo. Read-only.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      op: { type: "string", enum: ["check", "redact"] },
      keys: { type: "array", description: "Nomi var, max 50" },
      text: { type: "string", description: "Per redact, max 200k" },
    },
    required: ["op"],
    additionalProperties: false,
  },
  permissions: envSecretsPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: ENV_SECRETS_VERSION, since: "0.14.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<EnvSecretsOutput>> {
    return withTiming("env_secrets", ENV_SECRETS_VERSION, () => envSecretsLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "ENV_FAILED", message: err.message ?? String(e) };
    });
  },
};
