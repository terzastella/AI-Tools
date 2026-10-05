import { parsePublicUrl } from "../../core/net-guard.js";
import type { ToolContext } from "../../core/context.js";

export interface WebSearchInput {
  query: string;
  topK?: number;
  endpoint?: string;
  timeoutMs?: number;
}

export interface WebSearchHit {
  title: string;
  url: string;
}

export interface WebSearchOutput {
  query: string;
  hits: WebSearchHit[];
}

export const WEB_SEARCH_VERSION = "1.0.0";

/** Estrae link assoluti http con testo dai risultati. Best-effort: il layout DDG può cambiare. */
export function parseSearchHits(html: string, topK: number): WebSearchHit[] {
  const hits: WebSearchHit[] = [];
  const seen = new Set<string>();
  const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]{1,200}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && hits.length < topK) {
    let href = m[1]!.trim();
    const title = m[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (title.length < 15) continue;
    // DDG wrappa in //duckduckgo.com/l/?uddg=<encoded>
    const wrap = /uddg=([^&"]+)/.exec(href);
    if (wrap) {
      try {
        href = decodeURIComponent(wrap[1]!);
      } catch {
        continue;
      }
    }
    if (!/^https?:\/\//i.test(href) || seen.has(href)) continue;
    seen.add(href);
    hits.push({ title: title.slice(0, 200), url: href.slice(0, 500) });
  }
  return hits;
}

export async function webSearchLogic(ctx: ToolContext, input: WebSearchInput): Promise<WebSearchOutput> {
  const query = (input.query ?? "").trim();
  if (!query || query.length > 500) throw Object.assign(new Error("query 1..500 chars required"), { code: "BAD_ARGS" });
  const topK = input.topK ?? 5;
  if (!Number.isInteger(topK) || topK < 1 || topK > 20) throw Object.assign(new Error("topK must be 1..20"), { code: "BAD_ARGS" });
  const timeoutMs = input.timeoutMs ?? 20_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 5000 || timeoutMs > 60_000) {
    throw Object.assign(new Error("timeoutMs must be 5000..60000"), { code: "BAD_ARGS" });
  }
  const endpoint = (input.endpoint ?? "https://html.duckduckgo.com/html/").trim();
  const base = parsePublicUrl(endpoint, ctx);

  ctx.logger.info("web_search", { query: query.slice(0, 80) });
  const target = new URL(base);
  target.searchParams.set("q", query);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let html: string;
  try {
    const res = await fetch(target, {
      signal: ctrl.signal,
      headers: { "user-agent": "ai-tools/1.0 (+private agent)", "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
      body: `q=${encodeURIComponent(query)}`,
    });
    if (!res.ok) throw Object.assign(new Error(`http ${res.status}`), { code: "HTTP_ERROR" });
    html = await res.text();
  } catch (e: unknown) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === "AbortError") throw Object.assign(new Error(`timeout after ${timeoutMs}ms`), { code: "TIMEOUT" });
    const err = e as Error & { code?: string };
    throw Object.assign(new Error(err.message ?? String(e)), { code: err.code ?? "SEARCH_FAILED" });
  } finally {
    clearTimeout(timer);
  }
  return { query, hits: parseSearchHits(html, topK) };
}
