import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { scheduleCronLogic, SCHEDULE_CRON_VERSION, type ScheduleCronInput, type ScheduleCronOutput } from "./logic.js";
import { scheduleCronPermissions } from "./permissions.js";

export const scheduleCronDefinition: ToolDefinition<ScheduleCronInput, ScheduleCronOutput> = {
  name: "schedule_cron",
  label: "Schedule cron",
  description: "Promemoria schedulati in .agent/schedule (add/list/remove/due). L'agente controlla due a ogni giro; niente esecuzione automatica, l'azione la fai tu o un tool gated.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      op: { type: "string", enum: ["add", "list", "remove", "due"] },
      task: { type: "string", description: "Per add" },
      cron: { type: "string", description: "5 campi min hour dom month dow" },
      id: { type: "string", description: "Per remove" },
      now: { type: "string", description: "ISO per test, default ora" },
    },
    required: ["op"],
    additionalProperties: false,
  },
  permissions: scheduleCronPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: SCHEDULE_CRON_VERSION, since: "0.15.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<ScheduleCronOutput>> {
    return withTiming("schedule_cron", SCHEDULE_CRON_VERSION, () => scheduleCronLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "SCHEDULE_FAILED", message: err.message ?? String(e) };
    });
  },
};
