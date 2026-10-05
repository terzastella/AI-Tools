/**
 * Policy fail-closed per AI-Toolkit.
 * Deny vince sempre su allow. Default: preset standard.
 */
import type { PermissionRequirement } from "./types.js";

export interface PolicyRule {
  domain: string;
  action: "read" | "write" | "execute";
  /** glob su target/path relativo, es. src/**. Se omesso matcha tutto il domain+action. */
  targetGlob?: string;
}

export interface Policy {
  allow: PolicyRule[];
  deny: PolicyRule[];
}

export function matchTargetGlob(relPosix: string, pattern: string): boolean {
  const rel = relPosix.replace(/\\/g, "/");
  const pat = pattern.replace(/\\/g, "/");
  if (pat === "**" || pat === "*") return true;
  if (!pat.includes("*")) return rel === pat || rel.startsWith(pat.replace(/\/$/, "") + "/");
  const rx = new RegExp("^" + pat.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
  return rx.test(rel);
}

function ruleMatches(rule: PolicyRule, perm: PermissionRequirement, targetRel?: string): boolean {
  if (rule.domain !== perm.domain && rule.domain !== "*") return false;
  if (rule.action !== perm.action) return false;
  if (!rule.targetGlob) return true;
  if (!targetRel) return true; // senza target non possiamo restringere: match conservativo per allow? No: per deny blocca, per allow lascia a check successivo
  return matchTargetGlob(targetRel.replace(/\\/g, "/"), rule.targetGlob);
}

export function checkPolicy(
  policy: Policy,
  perm: PermissionRequirement,
  targetRel?: string,
): { allow: boolean; reason: string } {
  for (const d of policy.deny) {
    if (ruleMatches(d, perm, targetRel)) {
      return { allow: false, reason: `denied by rule ${d.domain}:${d.action}${d.targetGlob ? ":" + d.targetGlob : ""}` };
    }
  }
  for (const a of policy.allow) {
    if (ruleMatches(a, perm, targetRel)) {
      return { allow: true, reason: "allowed" };
    }
  }
  return { allow: false, reason: "no allow rule (fail-closed)" };
}

/** Estrae un target relativo best-effort dagli args noti (path, paths, edits[].path). */
export function extractTargets(args: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim().replace(/\\/g, "/"));
  };
  if (typeof args["path"] === "string") push(args["path"]);
  if (Array.isArray(args["paths"])) for (const p of args["paths"] as unknown[]) push(p);
  if (Array.isArray(args["edits"]))
    for (const e of args["edits"] as unknown[]) {
      if (e !== null && typeof e === "object" && typeof (e as Record<string, unknown>)["path"] === "string")
        push((e as Record<string, unknown>)["path"]);
    }
  return out.slice(0, 20);
}

export const readonlyPolicy: Policy = {
  allow: [{ domain: "filesystem", action: "read" }],
  deny: [
    { domain: "filesystem", action: "write" },
    { domain: "filesystem", action: "execute" },
  ],
};

export const standardPolicy: Policy = {
  allow: [
    { domain: "filesystem", action: "read" },
    { domain: "filesystem", action: "write", targetGlob: "src/**" },
    { domain: "filesystem", action: "write", targetGlob: "docs/**" },
    { domain: "filesystem", action: "write", targetGlob: "tests/**" },
    { domain: "filesystem", action: "write", targetGlob: "examples/**" },
    { domain: "filesystem", action: "write", targetGlob: ".tmp-*/**" },
    { domain: "filesystem", action: "write", targetGlob: ".agent/addons/**" },
    { domain: "filesystem", action: "write", targetGlob: ".agent/history/**" },
  ],
  deny: [
    { domain: "filesystem", action: "write", targetGlob: ".env*" },
    { domain: "filesystem", action: "write", targetGlob: ".git/**" },
    { domain: "filesystem", action: "write", targetGlob: "node_modules/**" },
    { domain: "filesystem", action: "write", targetGlob: "dist/**" },
  ],
};

export const strictPolicy: Policy = {
  allow: [{ domain: "filesystem", action: "read" }],
  deny: [
    { domain: "filesystem", action: "write" },
    { domain: "filesystem", action: "execute" },
  ],
};

/**
 * Fase 2 — policy stretta per il terminale.
 * Anche se la policy dice allow, serve sempre accept umano (vedi approval.ts).
 * I comandi pericolosi sono sempre deny, anche con accept.
 */
export const DANGEROUS_COMMAND_PATTERNS: RegExp[] = [
  /\brm\s+-rf\s+\//,
  /\bmkfs\b/,
  /\bdd\s+.*of=\/dev\//,
  /:\(\)\s*\{\s*:\|\:&\s*\}/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bhalt\b/,
  /\bpoweroff\b/,
];

export function isDangerousCommand(cmd: string): boolean {
  const c = cmd.toLowerCase();
  // download+exec cieco e pipe verso shell sono i più rischiosi per un principiante
  if (/(curl|wget)\s+.*\|\s*(sh|bash)/.test(c)) return true;
  return DANGEROUS_COMMAND_PATTERNS.some((re) => re.test(cmd));
}

export const execPolicy: Policy = {
  allow: [{ domain: "terminal", action: "execute" }],
  deny: [
    { domain: "terminal", action: "read" },
    { domain: "terminal", action: "write" },
  ],
};
