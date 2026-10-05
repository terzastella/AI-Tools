import type { PermissionRequirement } from "../../core/types.js";

export const formatCheckPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
