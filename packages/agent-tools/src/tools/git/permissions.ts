import type { PermissionRequirement } from "../../core/types.js";

export const gitPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
