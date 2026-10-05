/**
 * Guard di rete per i tool web: blocca SSRF verso loopback/reti private/metadata cloud.
 * I test locali usano ctx.allowPrivateNet = true.
 */
import type { ToolContext } from "./context.js";

function isPrivateIp(host: string): boolean {
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
