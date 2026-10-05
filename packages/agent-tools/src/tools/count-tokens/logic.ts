import type { ToolContext } from "../../core/context.js";

export interface CountTokensInput {
  text: string;
}

export interface CountTokensOutput {
  chars: number;
  words: number;
  lines: number;
  est_tokens: number;
}

export const COUNT_TOKENS_VERSION = "1.0.0";

/** Port di py-ref/token_count.py: stima euristica chars//4, non un tokenizer reale. */
export function countStats(text: string): CountTokensOutput {
  const chars = text.length;
  const lines = text ? text.split("\n").length : 0;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { chars, words, lines, est_tokens: Math.floor(chars / 4) };
}

export async function countTokensLogic(_ctx: ToolContext, input: CountTokensInput): Promise<CountTokensOutput> {
  const text = input.text ?? "";
  if (typeof text !== "string") throw Object.assign(new Error("text must be a string"), { code: "BAD_ARGS" });
  if (text.length > 500_000) throw Object.assign(new Error("text too big (max 500k chars)"), { code: "TOO_BIG" });
  return countStats(text);
}
