import type { PermissionRequirement } from "../../core/types.js";

export const historyPermissions: PermissionRequirement[] = [
  { domain: "filesystem", action: "read" },
  { domain: "filesystem", action: "write" },
];
