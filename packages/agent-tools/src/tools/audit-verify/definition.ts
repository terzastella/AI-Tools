import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { auditVerifyLogic, AUDIT_VERIFY_VERSION, type AuditVerifyInput, type AuditVerifyOutput } from "./logic.js";
import { auditVerifyPermissions } from "./permissions.js";

export const auditVerifyDefinition: ToolDefinition<AuditVerifyInput, AuditVerifyOutput> = {
  name: "audit_verify",
  label: "Audit verify",
  description:
    "Verifica la catena hash dell'audit giornaliero: dice se è integro o quale riga è manomessa. Solo lettura.",
  category: "other",
  parameters: {
    type: "object",
    properties: { date: { type: "string", description: "YYYY-MM-DD, default oggi" } },
    required: [],
    additionalProperties: false,
  },
  permissions: auditVerifyPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: AUDIT_VERIFY_VERSION, since: "0.18.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<AuditVerifyOutput>> {
    return withTiming(
      "audit_verify",
      AUDIT_VERIFY_VERSION,
      () => auditVerifyLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "VERIFY_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
