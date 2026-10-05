import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { typecheckFileLogic, TYPECHECK_FILE_VERSION, type TypecheckFileInput, type TypecheckFileOutput } from "./logic.js";
import { typecheckFilePermissions } from "./permissions.js";

export const typecheckFileDefinition: ToolDefinition<TypecheckFileInput, TypecheckFileOutput> = {
  name: "typecheck_file",
  label: "Typecheck file",
  description: "Stesso tsc di diagnose sul progetto, ma torna solo gli errori dei file richiesti. Stesso costo, foglio piccolo.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      paths: { type: "array", description: "1..10 file, es. ['src/a.ts']" },
      timeoutMs: { type: "number" },
    },
    required: ["paths"],
    additionalProperties: false,
  },
  permissions: typecheckFilePermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: TYPECHECK_FILE_VERSION, since: "0.10.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<TypecheckFileOutput>> {
    return withTiming("typecheck_file", TYPECHECK_FILE_VERSION, () => typecheckFileLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "TYPECHECK_FAILED", message: err.message ?? String(e) };
    });
  },
};
