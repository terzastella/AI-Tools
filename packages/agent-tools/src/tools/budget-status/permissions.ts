import type { PermissionRequirement } from "../../core/types.js";

/** Dominio dedicato: status legge, reset scrive (con accept umano). */
export const budgetStatusPermissions: PermissionRequirement[] = [
  { domain: "budget", action: "read" },
  { domain: "budget", action: "write" },
];
