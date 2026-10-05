import type { PermissionRequirement } from "../../core/types.js";

export const refactorPlanPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
