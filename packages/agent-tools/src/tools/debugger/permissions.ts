import type { PermissionRequirement } from "../../core/types.js";

export const debuggerPermissions: PermissionRequirement[] = [
  { domain: "filesystem", action: "read" },
  { domain: "filesystem", action: "write" },
];
