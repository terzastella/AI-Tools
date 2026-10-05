import type { PermissionRequirement } from "../../core/types.js";

export const renamePermissions: PermissionRequirement[] = [
  { domain: "filesystem", action: "read" },
  { domain: "filesystem", action: "write" },
];
