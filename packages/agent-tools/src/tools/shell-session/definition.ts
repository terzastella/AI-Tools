import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { shellSessionLogic, SHELL_SESSION_VERSION, type ShellSessionInput, type ShellSessionOutput } from "./logic.js";
import { shellSessionPermissions } from "./permissions.js";

export const shellSessionDefinition: ToolDefinition<ShellSessionInput, ShellSessionOutput> = {
  name: "shell_session",
  label: "Shell session",
  description: "Processi lunghi in background: start (senza shell) + poll output + kill + list. Per dev-server e test lunghi. Serve sempre accept umano.",
  category: "terminal",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["start", "poll", "kill", "list"] },
      id: { type: "string", description: "Per poll/kill" },
      cmd: { type: "string", description: "Binario singolo per start" },
      args: { type: "array", description: "Max 50" },
      workdir: { type: "string", description: "Subcartella dentro cwd" },
      tailChars: { type: "number", description: "100..50000, default 4000 per poll" },
    },
    required: ["action"],
    additionalProperties: false,
  },
  permissions: shellSessionPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: SHELL_SESSION_VERSION, since: "0.13.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<ShellSessionOutput>> {
    return withTiming("shell_session", SHELL_SESSION_VERSION, () => shellSessionLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "SESSION_FAILED", message: err.message ?? String(e) };
    });
  },
};
