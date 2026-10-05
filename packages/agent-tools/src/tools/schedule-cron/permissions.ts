import type { PermissionRequirement } from "../../core/types.js";

/** Dominio dedicato: la policy lo permette, i file restano in .agent/schedule dentro cwd. */
export const scheduleCronPermissions: PermissionRequirement[] = [
  { domain: "schedule", action: "read" },
  { domain: "schedule", action: "write" },
];
