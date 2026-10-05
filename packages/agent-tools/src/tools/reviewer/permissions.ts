import type { PermissionRequirement } from "../../core/types.js";

export const reviewerPermissions: PermissionRequirement[] = [
  { domain: "filesystem", action: "read" },
  // chiama diagnose (spawn tsc): serve accept umano quando c'è un approver
  { domain: "terminal", action: "execute" },
];
