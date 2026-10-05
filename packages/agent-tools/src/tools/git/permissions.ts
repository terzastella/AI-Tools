import type { PermissionRequirement } from "../../core/types.js";

export const gitPermissions: PermissionRequirement[] = [
  { domain: "filesystem", action: "read" },
  // lancia `git` via spawn: serve accept umano quando c'è un approver
  { domain: "terminal", action: "execute" },
];
