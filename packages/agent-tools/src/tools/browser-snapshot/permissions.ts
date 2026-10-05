import type { PermissionRequirement } from "../../core/types.js";

/** Lancia il browser headless: serve sempre accept umano. */
export const browserSnapshotPermissions: PermissionRequirement[] = [{ domain: "terminal", action: "execute" }];
