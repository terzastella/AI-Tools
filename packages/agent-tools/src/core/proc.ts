/**
 * Env scrubbed per i processi figli: niente ereditarietà cieca di process.env.
 * Passa solo una allowlist minima + eventuali extra espliciti
 * (es. env per-server da mcp-servers.json, mai tutto l'ambiente).
 */
import type { ToolContext } from "./context.js";

const BASE_ALLOW = [
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "OS",
  "TEMP",
  "TMP",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "LC_MESSAGES",
  "TZ",
  "HOME",
  "USER",
  "USERNAME",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
];

export const DEFAULT_ENV_ALLOW: readonly string[] = BASE_ALLOW;

export function scrubEnv(ctx: ToolContext, extra?: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const allow = new Set([...BASE_ALLOW, ...(ctx.envAllow ?? [])]);
  const out: NodeJS.ProcessEnv = {};
  for (const k of allow) {
    const v = process.env[k];
    if (typeof v === "string") out[k] = v;
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (typeof v === "string") out[k] = v;
    }
  }
  return out;
}
