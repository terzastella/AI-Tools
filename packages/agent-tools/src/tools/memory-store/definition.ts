import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { memoryStoreLogic, MEMORY_STORE_VERSION, type MemoryStoreInput, type MemoryStoreOutput } from "./logic.js";
import { memoryStorePermissions } from "./permissions.js";

export const memoryStoreDefinition: ToolDefinition<MemoryStoreInput, MemoryStoreOutput> = {
  name: "memory_store",
  label: "Memory store",
  description:
    "Memoria persistente locale in .agent/memory (session/project): put, get, search per parole, clear. Niente cloud.",
  category: "database",
  parameters: {
    type: "object",
    properties: {
      op: { type: "string", enum: ["put", "get", "search", "clear"] },
      text: { type: "string", description: "Per put, max 5000 chars" },
      id: { type: "string", description: "Per get" },
      query: { type: "string", description: "Per search" },
      scope: { type: "string", enum: ["session", "project"] },
      maxResults: { type: "number", description: "1..20, default 5" },
    },
    required: ["op"],
    additionalProperties: false,
  },
  permissions: memoryStorePermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: MEMORY_STORE_VERSION, since: "0.14.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<MemoryStoreOutput>> {
    return withTiming(
      "memory_store",
      MEMORY_STORE_VERSION,
      () => memoryStoreLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "MEMORY_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
