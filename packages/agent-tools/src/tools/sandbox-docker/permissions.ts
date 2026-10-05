import type { PermissionRequirement } from "../../core/types.js";

/** Esegue container: serve sempre accept umano. */
export const sandboxDockerPermissions: PermissionRequirement[] = [{ domain: "terminal", action: "execute" }];
