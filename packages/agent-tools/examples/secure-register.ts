/**
 * Registrazione sicura: bloccare + salvare su file (scelte confermate).
 * Nel tuo agent: packages/addons/src/core.ts -> installPlainTools() -> per ogni def: registry.register(wrapDefinition(def, ...))
 */
import { writerDefinition } from "../src/tools/writer/definition.js";
import { editorDefinition } from "../src/tools/editor/definition.js";
import { preparerDefinition } from "../src/tools/preparer/definition.js";
import { reviewerDefinition } from "../src/tools/reviewer/definition.js";
import { debuggerDefinition } from "../src/tools/debugger/definition.js";
import { skillCreatorDefinition } from "../src/tools/skill-creator/definition.js";
import { applyPatchDefinition } from "../src/tools/apply-patch/definition.js";
import { docGenDefinition } from "../src/tools/doc-gen/definition.js";
import { refactorPlanDefinition } from "../src/tools/refactor-plan/definition.js";
import { diagnoseDefinition } from "../src/tools/diagnose/definition.js";
import { searchProDefinition } from "../src/tools/search-pro/definition.js";
import { renameDefinition } from "../src/tools/rename/definition.js";
import { readDefinition } from "../src/tools/read/definition.js";
import { listDefinition } from "../src/tools/list/definition.js";
import { gotoDefinition } from "../src/tools/goto/definition.js";
import { refsDefinition } from "../src/tools/refs/definition.js";
import { moveDefinition } from "../src/tools/move/definition.js";
import { gitDefinition } from "../src/tools/git/definition.js";
import { todoDefinition } from "../src/tools/todo/definition.js";
import { delegateDefinition } from "../src/tools/delegate/definition.js";
import { findFilesDefinition } from "../src/tools/find-files/definition.js";
import { searchTextDefinition } from "../src/tools/search-text/definition.js";
import { editManyDefinition } from "../src/tools/edit-many/definition.js";
import { fileOutlineDefinition } from "../src/tools/file-outline/definition.js";
import { inspectSymbolDefinition } from "../src/tools/inspect-symbol/definition.js";
import { importMapDefinition } from "../src/tools/import-map/definition.js";
import { checkConfigDefinition } from "../src/tools/check-config/definition.js";
import { askUserDefinition } from "../src/tools/ask-user/definition.js";
import { formatCheckDefinition } from "../src/tools/format-check/definition.js";
import { historyDefinition } from "../src/tools/history/definition.js";
import { typecheckFileDefinition } from "../src/tools/typecheck-file/definition.js";
import { bashExecDefinition } from "../src/tools/bash-exec/definition.js";
import { countTokensDefinition } from "../src/tools/count-tokens/definition.js";
import { chunkTextDefinition } from "../src/tools/chunk-text/definition.js";
import { packContextDefinition } from "../src/tools/pack-context/definition.js";
import { wrapDefinition } from "../src/core/guarded.js";
import { standardPolicy } from "../src/core/policy.js";
import { FileAudit } from "../src/core/audit.js";
import { createContext } from "../src/core/context.js";

const all = [
  preparerDefinition,
  writerDefinition,
  editorDefinition,
  applyPatchDefinition,
  reviewerDefinition,
  debuggerDefinition,
  docGenDefinition,
  refactorPlanDefinition,
  skillCreatorDefinition,
  diagnoseDefinition,
  searchProDefinition,
  renameDefinition,
  readDefinition,
  listDefinition,
  gotoDefinition,
  refsDefinition,
  moveDefinition,
  gitDefinition,
  todoDefinition,
  delegateDefinition,
  findFilesDefinition,
  searchTextDefinition,
  editManyDefinition,
  fileOutlineDefinition,
  inspectSymbolDefinition,
  importMapDefinition,
  checkConfigDefinition,
  askUserDefinition,
  formatCheckDefinition,
  historyDefinition,
  typecheckFileDefinition,
  bashExecDefinition,
  countTokensDefinition,
  chunkTextDefinition,
  packContextDefinition,
];

export function secureDefinitions(cwd: string = process.cwd()) {
  // File di default attivo: .agent/audit/ai-toolkit-YYYY-MM-DD.jsonl (rotazione giornaliera)
  const audit = new FileAudit(cwd);
  return all.map((def) => wrapDefinition(def as never, { policy: standardPolicy, audit }) as never);
}

export async function demoSecure() {
  const ctx = createContext(process.cwd());
  const [secureWriter] = secureDefinitions(process.cwd());
  // @ts-expect-error demo generica
  const blocked = await (secureWriter as typeof writerDefinition).execute({ args: { path: "../escape.txt", content: "x" }, ctx });
  console.log("blocked:", blocked.ok, blocked.error?.code);
}
