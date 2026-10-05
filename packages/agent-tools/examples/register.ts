/**
 * Esempio integrazione nell'agent TS-first.
 * Nel tuo agent: packages/tools/src/builtin/ai-toolkit.ts
 *
 * import { registry } from "../registry.js";
 * import { writerDefinition, editorDefinition } from "ai-toolkit";
 * registry.register(writerDefinition);
 * registry.register(editorDefinition);
 *
 * Oppure come addon: .agent/addons/ai-toolkit/addon.json + index.js che re-esporta.
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
import { createContext } from "../src/core/context.js";

export const toolkitDefinitions = [
  writerDefinition,
  editorDefinition,
  preparerDefinition,
  reviewerDefinition,
  debuggerDefinition,
  skillCreatorDefinition,
  applyPatchDefinition,
  docGenDefinition,
  refactorPlanDefinition,
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
];

export async function demo() {
  const ctx = createContext(process.cwd());
  const p = await preparerDefinition.execute({ args: { goal: "demo hello", paths: ["src"], maxFiles: 5 }, ctx });
  console.log("preparer:", p);
  const w = await writerDefinition.execute({ args: { path: ".tmp-demo/hello.txt", content: "ciao\n", overwrite: true }, ctx });
  console.log("writer:", w);
  const e = await editorDefinition.execute({
    args: { path: ".tmp-demo/hello.txt", oldString: "ciao", newString: "ciao mondo" },
    ctx,
  });
  console.log("editor:", e);
}
