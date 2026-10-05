import type { PermissionRequirement } from "../../core/types.js";

export const writerPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "write" }];
