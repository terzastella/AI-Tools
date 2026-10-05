import type { PermissionRequirement } from "../../core/types.js";

export const findFilesPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
