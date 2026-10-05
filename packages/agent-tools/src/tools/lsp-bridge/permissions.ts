import type { PermissionRequirement } from "../../core/types.js";

export const lspBridgePermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
