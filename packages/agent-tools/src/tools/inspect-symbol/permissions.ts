import type { PermissionRequirement } from "../../core/types.js";

export const inspectSymbolPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
