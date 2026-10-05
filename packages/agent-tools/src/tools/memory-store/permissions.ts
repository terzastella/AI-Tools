import type { PermissionRequirement } from "../../core/types.js";

/** Dominio dedicato: la policy lo permette, i file restano in .agent/memory dentro cwd. */
export const memoryStorePermissions: PermissionRequirement[] = [
  { domain: "memory", action: "read" },
  { domain: "memory", action: "write" },
];
