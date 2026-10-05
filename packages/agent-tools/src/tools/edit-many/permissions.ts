import type { PermissionRequirement } from "../../core/types.js";

export const editManyPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "write" }];
