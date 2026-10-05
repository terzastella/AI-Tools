import type { PermissionRequirement } from "../../core/types.js";

export const typecheckFilePermissions: PermissionRequirement[] = [
  { domain: "filesystem", action: "read" },
  // lancia tsc via spawn: serve accept umano quando c'è un approver
  { domain: "terminal", action: "execute" },
];
