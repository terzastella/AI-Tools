import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { todoLogic, TODO_VERSION, type TodoInput, type TodoOutput } from "./logic.js";
import { todoPermissions } from "./permissions.js";

export const todoDefinition: ToolDefinition<TodoInput, TodoOutput> = {
  name: "todo",
  label: "Todo list",
  description: "Lista passi salvata in .agent/todos.json: add, list, complete, clear (solo completati).",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["add", "list", "complete", "clear"] },
      text: { type: "string" },
      id: { type: "string" },
    },
    required: [],
    additionalProperties: false,
  },
  permissions: todoPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: TODO_VERSION, since: "0.9.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<TodoOutput>> {
    return withTiming(
      "todo",
      TODO_VERSION,
      () => todoLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "TODO_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
