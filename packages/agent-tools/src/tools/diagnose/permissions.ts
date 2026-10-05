import type { PermissionRequirement } from "../../core/types.js";

export const diagnosePermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
