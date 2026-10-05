import type { PermissionRequirement } from "../../core/types.js";

export const reviewerPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
