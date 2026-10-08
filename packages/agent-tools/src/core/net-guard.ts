/**
 * Guard di rete per i tool web: blocca SSRF verso loopback/reti private/metadata cloud.
 * I test locali usano ctx.allowPrivateNet = true.
 */
import type { ToolContext } from "./context.js";

/** Export per test: vero se host loopback/rete privata/metadata (case-insensitive). */
export function isPrivateIp(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "ip6-localhost") return true;
  if (h === "::1" || h === "[::1]") return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) {
    return h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local");
  }
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 127 || a === 0) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export function parsePublicUrl(raw: string, ctx: ToolContext): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw Object.assign(new Error("bad url"), { code: "BAD_ARGS" });
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw Object.assign(new Error("only http/https urls"), { code: "BAD_ARGS" });
  }
  if (!ctx.allowPrivateNet && isPrivateIp(u.hostname)) {
    throw Object.assign(new Error(`private host blocked: ${u.hostname}`), { code: "PRIVATE_HOST" });
  }
  return u;
}

/** HTML -> testo leggibile: via script/style, tag -> spazi, entities base. */
export function htmlToText(html: string): string {
  let t = html.replace(/<script[\s\S]*?<\/script\s*>/gi, " ").replace(/<style[\s\S]*?<\/style\s*>/gi, " ");
  t = t.replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)\s*>/gi, "\n");
  t = t.replace(/<[^>]+>/g, " ");
  t = t
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
  return t
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

/**
 * Segue i redirect rivalidando OGNI hop contro la policy (niente follow cieco:
 * un redirect verso rete privata/metadata viene bloccato). Max 3 hop.
 * Ritorna l'URL finale già validato.
 */
export async function resolveRedirects(start: URL, ctx: ToolContext, timeoutMs: number, maxHops = 3): Promise<URL> {
  let current = start;
  for (let hop = 0; hop <= maxHops; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(current, { method: "HEAD", signal: ctrl.signal, redirect: "manual" });
    } catch (e: unknown) {
      clearTimeout(timer);
      if (e instanceof Error && e.name === "AbortError")
        throw Object.assign(new Error(`timeout after ${timeoutMs}ms`), { code: "TIMEOUT" });
      throw Object.assign(new Error(`fetch failed: ${e instanceof Error ? e.message : String(e)}`), {
        code: "FETCH_FAILED",
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status < 300 || res.status >= 400 || hop === maxHops) {
      if (hop === maxHops && res.status >= 300 && res.status < 400) {
        throw Object.assign(new Error("too many redirects (max 3)"), { code: "TOO_MANY_REDIRECTS" });
      }
      return current;
    }
    const loc = res.headers.get("location");
    if (!loc) return current;
    let next: URL;
    try {
      next = new URL(loc, current);
    } catch {
      throw Object.assign(new Error("bad redirect location"), { code: "BAD_REDIRECT" });
    }
    // rivalida ogni hop: protocollo + host privati
    parsePublicUrl(next.toString(), ctx);
    current = next;
  }
  throw Object.assign(new Error("too many redirects (max 3)"), { code: "TOO_MANY_REDIRECTS" });
}
