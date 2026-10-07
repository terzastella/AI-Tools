import { verifyAuditFile } from "../../core/audit.js";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface AuditVerifyInput {
  date?: string;
}

export interface AuditVerifyOutput {
  file: string;
  ok: boolean;
  checked: number;
  badLine?: number;
}

export const AUDIT_VERIFY_VERSION = "1.0.0";

export async function auditVerifyLogic(ctx: ToolContext, input: AuditVerifyInput): Promise<AuditVerifyOutput> {
  const d = (input.date ?? "").trim();
  let stamp: string;
  if (!d) {
    const now = new Date();
    const p = (n: number): string => String(n).padStart(2, "0");
    stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw Object.assign(new Error("date must be YYYY-MM-DD"), { code: "BAD_ARGS" });
    stamp = d;
  }
  const rel = `.agent/audit/ai-toolkit-${stamp}.jsonl`;
  const r = resolveSafePath(ctx, rel);
  if (!r.ok) throw Object.assign(new Error("audit escapes cwd"), { code: "PATH_TRAVERSAL" });
  const v = await verifyAuditFile(r.abs);
  const out: AuditVerifyOutput = { file: rel, ok: v.ok, checked: v.checked };
  if (v.badLine !== undefined) out.badLine = v.badLine;
  if (!v.ok && v.checked === 0) throw Object.assign(new Error(`no audit file: ${rel}`), { code: "NOT_FOUND" });
  return out;
}
