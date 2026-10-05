import { chatWithFallback, echoProvider, ollamaProvider } from "../../core/model-router.js";
import type { ToolContext } from "../../core/context.js";
import { packContextLogic } from "../pack-context/logic.js";

export interface RunSubagentInput {
  goal: string;
  paths?: string[];
  provider?: "ollama" | "echo";
  model?: string;
  system?: string;
  timeoutMs?: number;
}

export interface RunSubagentOutput {
  goal: string;
  result: string;
  model: string;
  provider: string;
  contextChars: number;
  truncated: boolean;
}

export const RUN_SUBAGENT_VERSION = "1.0.0";

export async function runSubagentLogic(ctx: ToolContext, input: RunSubagentInput): Promise<RunSubagentOutput> {
  const goal = (input.goal ?? "").trim();
  if (!goal || goal.length > 5000) throw Object.assign(new Error("goal 1..5000 chars required"), { code: "BAD_ARGS" });
  const providerName = input.provider ?? "ollama";
  if (providerName !== "ollama" && providerName !== "echo") {
    throw Object.assign(new Error("provider must be ollama|echo"), { code: "BAD_ARGS" });
  }
  const timeoutMs = input.timeoutMs ?? 120_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10_000 || timeoutMs > 300_000) {
    throw Object.assign(new Error("timeoutMs must be 10000..300000"), { code: "BAD_ARGS" });
  }

  // contesto isolato: solo i path chiesti, max 8k chars (il sub-agent non vede tutto)
  const paths = input.paths && input.paths.length > 0 ? input.paths : [];
  let contextText = "";
  if (paths.length > 0) {
    if (paths.length > 20) throw Object.assign(new Error("paths max 20"), { code: "BAD_ARGS" });
    const packed = await packContextLogic(ctx, { paths, max_chars: 8000 });
    contextText = packed.packed;
  }

  const prompt = contextText ? `Obiettivo: ${goal}\n\nContesto (sola lettura):\n${contextText}` : `Obiettivo: ${goal}`;
  const provider = providerName === "echo" ? echoProvider : ollamaProvider;
  const req: { prompt: string; system: string; timeoutMs: number; model?: string } = {
    prompt,
    system: input.system ?? "Sei un sub-agent: rispondi conciso, solo il risultato chiesto.",
    timeoutMs,
  };
  if (input.model !== undefined) req.model = input.model;
  const res = await chatWithFallback(ctx, [provider], req);
  ctx.logger.info("run_subagent", { provider: res.provider, goal: goal.slice(0, 80) });
  return { goal, result: res.text, model: res.model, provider: res.provider, contextChars: contextText.length, truncated: res.text.length >= 50_000 };
}
