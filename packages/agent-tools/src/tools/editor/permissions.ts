import type { PermissionRequirement } from "../../core/types.js";

export const editorPermissions: PermissionRequirement[] = [
  { domain: "filesystem", action: "read" },
  { domain: "filesystem", action: "write" },
];
