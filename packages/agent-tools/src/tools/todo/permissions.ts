import type { PermissionRequirement } from "../../core/types.js";

export const todoPermissions: PermissionRequirement[] = [
  // dominio dedicato: la lista vive in .agent/todos.json e non ha path-args,
  // con filesystem:write sarebbe sempre deny fail-closed quando avvolto
  { domain: "todo", action: "read" },
  { domain: "todo", action: "write" },
];
