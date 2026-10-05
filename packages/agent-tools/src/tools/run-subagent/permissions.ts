import type { PermissionRequirement } from "../../core/types.js";

/** Lavoro delegato a un modello (tempo/costo): serve sempre accept umano. */
export const runSubagentPermissions: PermissionRequirement[] = [{ domain: "terminal", action: "execute" }];
