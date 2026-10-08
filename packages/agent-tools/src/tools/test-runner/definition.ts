import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { testRunnerLogic, TEST_RUNNER_VERSION, type TestRunnerInput, type TestRunnerOutput } from "./logic.js";
import { testRunnerPermissions } from "./permissions.js";

export const testRunnerDefinition: ToolDefinition<TestRunnerInput, TestRunnerOutput> = {
  name: "test_runner",
  label: "Test runner",
  description:
    "Lancia vitest/pytest/npm test e ritorna pass/fail strutturati. Senza shell, con timeout. Serve sempre accept umano.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      runner: { type: "string", enum: ["vitest", "pytest", "npm"] },
      pattern: { type: "string", description: "Filtro file/test, max 300 chars" },
      workdir: { type: "string", description: "Subcartella dentro cwd" },
      timeoutMs: { type: "number", description: "10000..300000, default 120000" },
    },
    required: ["runner"],
    additionalProperties: false,
  },
  permissions: testRunnerPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: TEST_RUNNER_VERSION, since: "0.13.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<TestRunnerOutput>> {
    return withTiming(
      "test_runner",
      TEST_RUNNER_VERSION,
      () => testRunnerLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "TEST_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
