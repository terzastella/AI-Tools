import type { PermissionRequirement } from "../../core/types.js";

/** Lancia git locale (mai rete): serve sempre accept umano. I path sono validati in logic. */
export const gitWritePermissions: PermissionRequirement[] = [{ domain: "terminal", action: "execute" }];
