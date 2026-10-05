import type { PermissionRequirement } from "../../core/types.js";

export const todoPermissions: PermissionRequirement[] = [
  { domain: "filesystem", action: "read" },
  { domain: "filesystem", action: "write" },
];
