import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export type TodoAction = "add" | "list" | "complete" | "clear";
export type TodoStatus = "pending" | "in_progress" | "completed";

export interface TodoItem {
  id: string;
  text: string;
  status: TodoStatus;
  createdAt: string;
}

export interface TodoInput {
  action?: TodoAction;
  text?: string;
  id?: string;
}

export interface TodoOutput {
  action: TodoAction;
  todos: TodoItem[];
}

export const TODO_VERSION = "1.0.0";
const FILE = ".agent/todos.json";

async function load(cwd: string): Promise<TodoItem[]> {
  try {
    const raw = await fs.readFile(path.join(cwd, FILE), "utf8");
    const arr = JSON.parse(raw) as TodoItem[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function save(cwd: string, todos: TodoItem[]): Promise<void> {
  await fs.mkdir(path.join(cwd, ".agent"), { recursive: true });
  const tmp = path.join(cwd, ".agent/todos.json.tmp");
  await fs.writeFile(tmp, JSON.stringify(todos, null, 2), "utf8");
  await fs.rename(tmp, path.join(cwd, FILE));
}

export async function todoLogic(ctx: ToolContext, input: TodoInput): Promise<TodoOutput> {
  const action = input.action ?? "list";
  // anti-traversal: il file è sempre dentro cwd, nessun input path
  void resolveSafePath(ctx, ".");
  const todos = await load(ctx.cwd);

  if (action === "list") {
    return { action, todos };
  }
  if (action === "add") {
    const text = (input.text ?? "").trim().slice(0, 300);
    if (!text) throw Object.assign(new Error("text is required for add"), { code: "BAD_ARGS" });
    const item: TodoItem = { id: `t${Date.now().toString(36)}${todos.length}`, text, status: "pending", createdAt: new Date().toISOString() };
    todos.push(item);
    await save(ctx.cwd, todos);
    ctx.logger.info("todo", { action, id: item.id });
    return { action, todos };
  }
  if (action === "complete") {
    const id = (input.id ?? "").trim();
    if (!id) throw Object.assign(new Error("id is required for complete"), { code: "BAD_ARGS" });
    const item = todos.find((t) => t.id === id);
    if (!item) throw Object.assign(new Error(`todo not found: ${id}`), { code: "NOT_FOUND" });
    item.status = "completed";
    await save(ctx.cwd, todos);
    return { action, todos };
  }
  // clear: solo completati
  const remaining = todos.filter((t) => t.status !== "completed");
  await save(ctx.cwd, remaining);
  return { action, todos: remaining };
}
