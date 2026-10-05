import type { PermissionRequirement } from "../../core/types.js";

export const readPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
