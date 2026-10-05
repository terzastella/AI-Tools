import { htmlToText, parsePublicUrl } from "../../core/net-guard.js";
import type { ToolContext } from "../../core/context.js";

export interface WebFetchInput {
  url: string;
  maxChars?: number;
  extract?: "text" | "markdown" | "html";
  timeoutMs?: number;
}

export interface WebFetchOutput {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  text: string;
  truncated: boolean;
}

export const WEB_FETCH_VERSION = "1.0.0";

export async function webFetchLogic(ctx: ToolContext, input: WebFetchInput): Promise<WebFetchOutput> {
  const u = parsePublicUrl(input.url ?? "", ctx);
  const maxChars = input.maxChars ?? 20_000;
  if (!Number.isInteger(maxChars) || maxChars < 500 || maxChars > 100_000) {
    throw Object.assign(new Error("maxChars must be 500..100000"), { code: "BAD_ARGS" });
  }
  const extract = input.extract ?? "text";
  if (extract !== "text" && extract !== "markdown" && extract !== "html") {
    throw Object.assign(new Error("extract must be text|markdown|html"), { code: "BAD_ARGS" });
  }
  const timeoutMs = input.timeoutMs ?? 20_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 5000 || timeoutMs > 60_000) {
    throw Object.assign(new Error("timeoutMs must be 5000..60000"), { code: "BAD_ARGS" });
  }

  ctx.logger.info("web_fetch", { url: u.hostname });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(u, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": "ai-tools/1.0 (+private agent)" } });
  } catch (e: unknown) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === "AbortError") throw Object.assign(new Error(`timeout after ${timeoutMs}ms`), { code: "TIMEOUT" });
    throw Object.assign(new Error(`fetch failed: ${e instanceof Error ? e.message : String(e)}`), { code: "FETCH_FAILED" });
  } finally {
    clearTimeout(timer);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) throw Object.assign(new Error(`http ${res.status} for ${u.hostname}`), { code: "HTTP_ERROR" });
  if (contentType && !/text|html|json|xml|markdown/i.test(contentType)) {
    throw Object.assign(new Error(`unsupported content-type: ${contentType}`), { code: "BAD_CONTENT" });
  }

  const raw = (await res.text()).slice(0, maxChars + 1000);
  let text: string;
  if (extract === "html") {
    text = raw;
  } else if (/json/i.test(contentType)) {
    try {
      text = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      text = raw;
    }
  } else {
    text = htmlToText(raw);
  }
  const truncated = text.length > maxChars;
  return { url: input.url, finalUrl: res.url, status: res.status, contentType, text: text.slice(0, maxChars), truncated };
}
