import type { PermissionRequirement } from "../../core/types.js";

export const bashExecPermissions: PermissionRequirement[] = [{ domain: "terminal", action: "execute" }];
