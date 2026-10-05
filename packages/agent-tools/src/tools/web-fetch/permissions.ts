import type { PermissionRequirement } from "../../core/types.js";

/** Rete esterna: lettura, ma verso host pubblici. Nessun permesso speciale oltre read. */
export const webFetchPermissions: PermissionRequirement[] = [{ domain: "filesystem", action: "read" }];
