/**
 * Model router minimo: provider pluggabili con fallback.
 * - echo: per test, rimanda il prompt (mai rete)
 * - ollama: modello locale via http://127.0.0.1:11434 (come prompt_run.py)
 *   Solo loopback di default; altri host solo con ctx.allowPrivateNet.
 */
import type { ToolContext } from "./context.js";

export interface ModelRequest {
  prompt: string;
  system?: string;
  model?: string;
  timeoutMs?: number;
}

export interface ModelResponse {
  text: string;
  model: string;
  provider: string;
}

export interface ModelProvider {
  name: string;
  chat(ctx: ToolContext, req: Required<Pick<ModelRequest, "prompt">> & Omit<ModelRequest, "prompt">): Promise<ModelResponse>;
}

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

export const echoProvider: ModelProvider = {
  name: "echo",
  async chat(_ctx, req) {
    const sys = req.system ? `[system: ${req.system}]\n` : "";
    return { text: `${sys}[echo:${req.model}]\n${req.prompt}`.slice(0, 20_000), model: req.model ?? "echo", provider: "echo" };
  },
};

export const ollamaProvider: ModelProvider = {
  name: "ollama",
  async chat(ctx, req) {
    const host = process.env["OLLAMA_HOST"] ?? "http://127.0.0.1:11434";
    const url = new URL("/api/generate", host);
    const loopback = /^(127\.|localhost|\[::1\])/.test(url.hostname);
    if (!loopback && !ctx.allowPrivateNet) fail("PRIVATE_HOST", "ollama solo su loopback senza allowPrivateNet");
    const model = req.model ?? process.env["OLLAMA_MODEL"] ?? "llama3.1";
    const timeoutMs = req.timeoutMs ?? 120_000;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, prompt: req.prompt, system: req.system ?? "", stream: false }),
      });
      if (!res.ok) fail("MODEL_ERROR", `ollama http ${res.status} (modello ${model} scaricato? serve Ollama acceso)`);
      const data = (await res.json()) as { response?: string };
      return { text: String(data.response ?? "").slice(0, 50_000), model, provider: "ollama" };
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") fail("TIMEOUT", `ollama timeout after ${timeoutMs}ms`);
      const err = e as Error & { code?: string };
      if (err.code) throw e;
      fail("OLLAMA_MISSING", `ollama non raggiungibile su ${host} (${err.message ?? String(e)})`);
    } finally {
      clearTimeout(timer);
    }
    throw new Error("unreachable");
  },
};

/** Prima il default, poi i fallback in ordine. Ritorna la prima che riesce. */
export async function chatWithFallback(
  ctx: ToolContext,
  providers: ModelProvider[],
  req: ModelRequest,
): Promise<ModelResponse> {
  if (!req.prompt?.trim()) fail("BAD_ARGS", "prompt required");
  if (providers.length === 0) fail("BAD_ARGS", "no providers");
  const errors: string[] = [];
  for (const p of providers) {
    try {
      return await p.chat(ctx, { ...req, prompt: req.prompt });
    } catch (e: unknown) {
      const err = e as Error & { code?: string };
      errors.push(`${p.name}: ${err.code ?? "?"} ${err.message ?? String(e)}`.slice(0, 200));
    }
  }
  fail("MODEL_ERROR", `tutti i provider falliti: ${errors.join(" | ").slice(0, 500)}`);
}
