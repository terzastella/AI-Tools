import type { PermissionRequirement } from "../../core/types.js";

export const checkConfigPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
