import type { PermissionRequirement } from "../../core/types.js";

export const delegatePermissions: PermissionRequirement[] = [
  { domain: "filesystem", action: "read" },
  { domain: "filesystem", action: "write" },
];
