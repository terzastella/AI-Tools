import type { PermissionRequirement } from "../../core/types.js";

export const applyPatchPermissions: PermissionRequirement[] = [
  { domain: "filesystem", action: "read" },
  { domain: "filesystem", action: "write" },
];
