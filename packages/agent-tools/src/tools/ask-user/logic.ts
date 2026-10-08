import type { ToolContext } from "../../core/context.js";

export interface AskUserOption {
  label: string;
  description?: string;
}

export interface AskUserInput {
  question: string;
  options: AskUserOption[];
  multi?: boolean;
}

export interface AskUserOutput {
  question: string;
  options: AskUserOption[];
  multi: boolean;
  hint: string;
}

export const ASK_USER_VERSION = "1.0.0";

export async function askUserLogic(_ctx: ToolContext, input: AskUserInput): Promise<AskUserOutput> {
  const question = (input.question ?? "").trim();
  if (!question) throw Object.assign(new Error("question is required"), { code: "BAD_ARGS" });
  const options = input.options ?? [];
  if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
    throw Object.assign(new Error("options must be 2..6 items"), { code: "BAD_ARGS" });
  }
  for (const o of options) {
    if (!o.label || !o.label.trim()) throw Object.assign(new Error("option label required"), { code: "BAD_ARGS" });
  }
  const multi = input.multi ?? false;
  return {
    question,
    options: options.map((o) => ({
      label: o.label.trim().slice(0, 80),
      ...(o.description ? { description: o.description.slice(0, 200) } : {}),
    })),
    multi,
    hint: "Mostra queste opzioni all'umano e reinietta la risposta scelta.",
  };
}
