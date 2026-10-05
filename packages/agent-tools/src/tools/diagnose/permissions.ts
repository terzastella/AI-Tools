import type { PermissionRequirement } from "../../core/types.js";

export const diagnosePermissions: PermissionRequirement[] = [
  { domain: "filesystem", action: "read" },
  // lancia tsc/eslint/vitest via spawn: serve accept umano quando c'è un approver
  { domain: "terminal", action: "execute" },
];
