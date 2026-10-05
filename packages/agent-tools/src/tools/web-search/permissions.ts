import type { PermissionRequirement } from "../../core/types.js";

export const webSearchPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
