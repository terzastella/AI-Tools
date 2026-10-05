/**
 * Approval gate accept/deny per AI-Tools.
 * Idea semplice: le letture passano da sole,
 * le scritture e le esecuzioni chiedono sempre all'umano.
 */

export type ApprovalDecision = "accept" | "deny";

export interface ApprovalRequest {
  tool: string;
  action: "read" | "write" | "execute";
  targets: string[];
  reason: string;
}

export type Approver = (req: ApprovalRequest) => Promise<ApprovalDecision> | ApprovalDecision;

/** Solo read passa da solo. Write ed execute chiedono sempre. */
export function needsApproval(action: "read" | "write" | "execute"): boolean {
  return action !== "read";
}

/** Approver finti per test ed esempi. */
export const acceptAllApprover: Approver = () => "accept";
export const denyAllApprover: Approver = () => "deny";
