import type { PermissionRequirement } from "../../core/types.js";

/** Scrive file (eslint --fix) + lancia processo: chiede sempre accept umano. */
export const lintFixPermissions: PermissionRequirement[] = [
  { domain: "filesystem", action: "write" },
  { domain: "terminal", action: "execute" },
];
