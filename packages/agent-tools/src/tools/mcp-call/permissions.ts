import type { PermissionRequirement } from "../../core/types.js";

/** Esegue un processo esterno: serve sempre accept umano (approval gate). */
export const mcpCallPermissions: PermissionRequirement[] = [{ domain: "terminal", action: "execute" }];
