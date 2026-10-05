/**
 * Core result types — compatibili con AgentToolResult dell'agent custom.
 * Mai throw raw dai tool: ritorna sempre ToolResult.
 */

export interface ToolError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ToolMeta {
  tool: string;
  version: string;
  durationMs: number;
}

export interface AgentToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: ToolError;
  meta: ToolMeta;
}

export function ok<T>(tool: string, version: string, data: T, durationMs: number): AgentToolResult<T> {
  return { ok: true, data, meta: { tool, version, durationMs } };
}

export function fail(
  tool: string,
  version: string,
  code: string,
  message: string,
  durationMs: number,
  details?: Record<string, unknown>,
): AgentToolResult<never> {
  const error: ToolError = details === undefined ? { code, message } : { code, message, details };
  return { ok: false, error, meta: { tool, version, durationMs } };
}

/** Esegue fn misurando durationMs e convertendo throw in fail(). */
export async function withTiming<T>(
  tool: string,
  version: string,
  fn: () => Promise<T>,
  toError: (e: unknown) => { code: string; message: string; details?: Record<string, unknown> } = (e) => ({
    code: "INTERNAL",
    message: e instanceof Error ? e.message : String(e),
  }),
): Promise<AgentToolResult<T>> {
  const start = performance.now();
  try {
    const data = await fn();
    return ok(tool, version, data, Math.round(performance.now() - start));
  } catch (e) {
    const mapped = toError(e);
    return fail(tool, version, mapped.code, mapped.message, Math.round(performance.now() - start), mapped.details);
  }
}
