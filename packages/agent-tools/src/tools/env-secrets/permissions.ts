import type { PermissionRequirement } from "../../core/types.js";

/** Solo lettura env (mai i valori) + redact testo: nessun permesso speciale. */
export const envSecretsPermissions: PermissionRequirement[] = [];
