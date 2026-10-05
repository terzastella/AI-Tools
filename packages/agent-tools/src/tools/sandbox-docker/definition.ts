import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { sandboxDockerLogic, SANDBOX_DOCKER_VERSION, type SandboxDockerInput, type SandboxDockerOutput } from "./logic.js";
import { sandboxDockerPermissions } from "./permissions.js";

export const sandboxDockerDefinition: ToolDefinition<SandboxDockerInput, SandboxDockerOutput> = {
  name: "sandbox_docker",
  label: "Sandbox docker",
  description: "Esegue un comando in container isolato (no rete, 512MB, 1 CPU, solo cwd montato). DOCKER_MISSING se docker è spento. Serve sempre accept umano.",
  category: "terminal",
  parameters: {
    type: "object",
    properties: {
      image: { type: "string", description: "Es. node:20-alpine" },
      cmd: { type: "array", description: "Comando + args, max 20" },
      workdir: { type: "string", description: "Subcartella dentro cwd da montare" },
      timeoutMs: { type: "number", description: "10000..300000, default 60000" },
    },
    required: ["image", "cmd"],
    additionalProperties: false,
  },
  permissions: sandboxDockerPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: SANDBOX_DOCKER_VERSION, since: "0.15.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<SandboxDockerOutput>> {
    return withTiming("sandbox_docker", SANDBOX_DOCKER_VERSION, () => sandboxDockerLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "SANDBOX_FAILED", message: err.message ?? String(e) };
    });
  },
};
