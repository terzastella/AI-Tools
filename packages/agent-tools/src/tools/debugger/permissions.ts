import type { PermissionRequirement } from "../../core/types.js";

export const debuggerPermissions: PermissionRequirement[] = [
  { domain: "filesystem", action: "read" },
  { domain: "filesystem", action: "write" },
  // chiama diagnose/reviewer (spawn tsc): serve accept umano quando c'è un approver
  { domain: "terminal", action: "execute" },
];
