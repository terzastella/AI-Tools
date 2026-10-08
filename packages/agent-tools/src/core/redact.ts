/**
 * Redazione secret-like dai testi destinati ai log/audit.
 * Maschera i VALORI, tiene i prefissi: "api_key=***", "Bearer ***".
 * Euristica best-effort, mai throw. Punto unico: audit.write.
 */
const PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/g,
  /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{10,}/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /([Bb]earer\s+)[A-Za-z0-9\-._~+/=]{10,}/g,
  /((?:api[_-]?key|secret|token|passwd|password)\s*[:=]\s*['"]?)[^'"\s,}]{6,}/gi,
  /\b[A-Fa-f0-9]{32,}\b/g,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
];

export function redactSecrets(text: string): string {
  if (!text) return text;
  let out = text;
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, (m: string, ...rest: unknown[]) => {
      // gruppi regex meno offset/stringa finali: il primo non vuoto è il prefisso da tenere
      const prefix = rest
        .slice(0, -2)
        .find((g): g is string => typeof g === "string" && g.length > 0 && g.length < m.length);
      return prefix ? `${prefix}***` : "***";
    });
  }
  return out;
}
