import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { listLogic, LIST_VERSION, type ListInput, type ListOutput } from "./logic.js";
import { listPermissions } from "./permissions.js";

export const listDefinition: ToolDefinition<ListInput, ListOutput> = {
  name: "list_directory",
  label: "List directory",
  description: "Elenco cartella: file e sottocartelle ordinati (dir prima). Solo lettura, blocca traversal.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Default '.'" },
      recursive: { type: "boolean", description: "Default false" },
      maxEntries: { type: "number", description: "1..1000, default 100" },
      includeHidden: { type: "boolean", description: "Default false" },
    },
    required: [],
    additionalProperties: false,
  },
  permissions: listPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: LIST_VERSION, since: "0.8.4" },
  async execute({ args, ctx }): Promise<AgentToolResult<ListOutput>> {
    return withTiming(
      "list_directory",
      LIST_VERSION,
      () => listLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "LIST_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
