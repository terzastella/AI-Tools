import type { PermissionRequirement } from "../../core/types.js";

export const imageReadPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
