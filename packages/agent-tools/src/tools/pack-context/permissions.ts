import type { PermissionRequirement } from "../../core/types.js";

export const packContextPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
