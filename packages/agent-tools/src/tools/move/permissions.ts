import type { PermissionRequirement } from "../../core/types.js";

export const movePermissions: PermissionRequirement[] = [
  { domain: "filesystem", action: "read" },
  { domain: "filesystem", action: "write" },
];
