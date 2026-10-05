import type { PermissionRequirement } from "../../core/types.js";

export const gotoPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
