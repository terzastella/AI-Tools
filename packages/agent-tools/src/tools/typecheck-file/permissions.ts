import type { PermissionRequirement } from "../../core/types.js";

export const typecheckFilePermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
