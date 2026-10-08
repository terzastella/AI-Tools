import type { ToolContext } from "../../core/context.js";

export interface EnvSecretsInput {
  op: "check" | "redact";
  keys?: string[];
  text?: string;
}

export interface EnvSecretsOutput {
  op: string;
  checked?: { key: string; set: boolean; length: number }[];
  redacted?: string;
}

export const ENV_SECRETS_VERSION = "1.0.0";

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

export function redactSecrets(text: string, keys: string[]): string {
  let out = text;
  const values = keys.map((k) => process.env[k]).filter((v): v is string => typeof v === "string" && v.length >= 4);
  // prima i valori lunghi (evita maschere parziali)
  values.sort((a, b) => b.length - a.length);
  for (const v of values) {
    out = out.split(v).join("***");
  }
  return out;
}

export async function envSecretsLogic(_ctx: ToolContext, input: EnvSecretsInput): Promise<EnvSecretsOutput> {
  const op = input.op ?? "";
  if (op === "check") {
    const keys = input.keys ?? [];
    if (!Array.isArray(keys) || keys.length === 0 || keys.length > 50) {
      throw Object.assign(new Error("keys must be an array 1..50"), { code: "BAD_ARGS" });
    }
    const checked = keys.map((k) => {
      if (typeof k !== "string" || !KEY_RE.test(k))
        throw Object.assign(new Error(`bad key name: ${k}`), { code: "BAD_ARGS" });
      const v = process.env[k];
      // mai ritornare il valore: solo set + lunghezza
      return { key: k, set: typeof v === "string" && v.length > 0, length: typeof v === "string" ? v.length : 0 };
    });
    return { op, checked };
  }
  if (op === "redact") {
    const text = input.text ?? "";
    if (typeof text !== "string" || text.length > 200_000) {
      throw Object.assign(new Error("text must be a string max 200k"), { code: "BAD_ARGS" });
    }
    const keys = input.keys ?? [];
    if (!Array.isArray(keys) || keys.length > 50) throw Object.assign(new Error("keys max 50"), { code: "BAD_ARGS" });
    for (const k of keys) {
      if (typeof k !== "string" || !KEY_RE.test(k))
        throw Object.assign(new Error(`bad key name: ${k}`), { code: "BAD_ARGS" });
    }
    return { op, redacted: redactSecrets(text, keys) };
  }
  throw Object.assign(new Error(`unknown op: ${op} (check|redact)`), { code: "BAD_ARGS" });
}
