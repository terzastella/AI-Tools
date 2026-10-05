import type { PermissionRequirement } from "../../core/types.js";

export const importMapPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
