import type { PermissionRequirement } from "../../core/types.js";

export const searchTextPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
