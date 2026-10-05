import type { PermissionRequirement } from "../../core/types.js";

/** Lancia test esterni: serve sempre accept umano. */
export const testRunnerPermissions: PermissionRequirement[] = [{ domain: "terminal", action: "execute" }];
