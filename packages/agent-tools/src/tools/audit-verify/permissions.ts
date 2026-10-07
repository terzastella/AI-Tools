import type { PermissionRequirement } from "../../core/types.js";

export const auditVerifyPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
