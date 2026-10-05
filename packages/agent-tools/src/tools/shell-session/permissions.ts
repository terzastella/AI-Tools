import type { PermissionRequirement } from "../../core/types.js";

/** Processi esterni: serve sempre accept umano. */
export const shellSessionPermissions: PermissionRequirement[] = [{ domain: "terminal", action: "execute" }];
