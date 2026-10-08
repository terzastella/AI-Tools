/**
 * Tipi compatibili con l'agent TS-first:
 * packages/tools/src/types.ts ToolDefinition + registry.register(def)
 * Qui li ridefiniamo in forma minimale e stabile (v1) così
 * AI-Toolkit può vivere in repo separato e venire registrato
 * senza dipendere dal codice dell'agent.
 */

import type { ToolContext } from "./context.js";
import type { AgentToolResult } from "./result.js";

export type ToolCategory = "filesystem" | "terminal" | "git" | "database" | "search" | "mcp" | "other";

export interface PermissionRequirement {
  domain: string;
  action: "read" | "write" | "execute";
  target?: string;
}

/** Sottoinsieme JSONSchema sufficiente per parameters dei tool core. */
export interface Schema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolExecuteArgs<TArgs = Record<string, unknown>> {
  args: TArgs;
  ctx: ToolContext;
  signal?: AbortSignal;
}

export interface ToolMetadata {
  version: string;
  author?: string;
  since?: string;
}

export interface ToolDefinition<TArgs = Record<string, unknown>, TOut = unknown> {
  /** snake_case visto dal modello, es. create_file */
  name: string;
  label: string;
  description: string;
  category: ToolCategory;
  parameters: Schema;
  permissions: PermissionRequirement[];
  execute(args: ToolExecuteArgs<TArgs>): Promise<AgentToolResult<TOut>>;
  timeoutMs?: number;
  metadata?: Partial<ToolMetadata>;
}

export const DEFAULT_TIMEOUT_MS = 120_000;
