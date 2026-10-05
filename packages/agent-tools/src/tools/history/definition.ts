import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { historyLogic, HISTORY_VERSION, type HistoryInput, type HistoryOutput } from "./logic.js";
import { historyPermissions } from "./permissions.js";

export const historyDefinition: ToolDefinition<HistoryInput, HistoryOutput> = {
  name: "history",
  label: "History",
  description: "Foto versionate manuali: record, list, restore, clear. Magazzino .agent/history, mai il file originale su clear.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["record", "list", "restore", "clear"] },
      path: { type: "string" },
      versionId: { type: "string" },
      maxVersions: { type: "number", description: "1..100, default 20" },
    },
    required: [],
    additionalProperties: false,
  },
  permissions: historyPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: HISTORY_VERSION, since: "0.10.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<HistoryOutput>> {
    return withTiming("history", HISTORY_VERSION, () => historyLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "HISTORY_FAILED", message: err.message ?? String(e) };
    });
  },
};
