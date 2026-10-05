import type { PermissionRequirement } from "../../core/types.js";

export const historyPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "write" }];
