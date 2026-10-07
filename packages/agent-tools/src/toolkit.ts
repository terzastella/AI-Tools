/**
 * Unico array con le 52 ToolDefinition, nell'ordine di secure-register.
 * Per chi costruisce un agent: un import, un loop di register.
 */
import type { ToolDefinition } from "./core/types.js";
import { writerDefinition } from "./tools/writer/definition.js";
import { editorDefinition } from "./tools/editor/definition.js";
import { preparerDefinition } from "./tools/preparer/definition.js";
import { reviewerDefinition } from "./tools/reviewer/definition.js";
import { debuggerDefinition } from "./tools/debugger/definition.js";
import { skillCreatorDefinition } from "./tools/skill-creator/definition.js";
import { applyPatchDefinition } from "./tools/apply-patch/definition.js";
import { docGenDefinition } from "./tools/doc-gen/definition.js";
import { refactorPlanDefinition } from "./tools/refactor-plan/definition.js";
import { diagnoseDefinition } from "./tools/diagnose/definition.js";
import { searchProDefinition } from "./tools/search-pro/definition.js";
import { renameDefinition } from "./tools/rename/definition.js";
import { readDefinition } from "./tools/read/definition.js";
import { listDefinition } from "./tools/list/definition.js";
import { gotoDefinition } from "./tools/goto/definition.js";
import { refsDefinition } from "./tools/refs/definition.js";
import { moveDefinition } from "./tools/move/definition.js";
import { gitDefinition } from "./tools/git/definition.js";
import { todoDefinition } from "./tools/todo/definition.js";
import { delegateDefinition } from "./tools/delegate/definition.js";
import { findFilesDefinition } from "./tools/find-files/definition.js";
import { searchTextDefinition } from "./tools/search-text/definition.js";
import { editManyDefinition } from "./tools/edit-many/definition.js";
import { fileOutlineDefinition } from "./tools/file-outline/definition.js";
import { inspectSymbolDefinition } from "./tools/inspect-symbol/definition.js";
import { importMapDefinition } from "./tools/import-map/definition.js";
import { checkConfigDefinition } from "./tools/check-config/definition.js";
import { askUserDefinition } from "./tools/ask-user/definition.js";
import { formatCheckDefinition } from "./tools/format-check/definition.js";
import { historyDefinition } from "./tools/history/definition.js";
import { typecheckFileDefinition } from "./tools/typecheck-file/definition.js";
import { bashExecDefinition } from "./tools/bash-exec/definition.js";
import { countTokensDefinition } from "./tools/count-tokens/definition.js";
import { chunkTextDefinition } from "./tools/chunk-text/definition.js";
import { packContextDefinition } from "./tools/pack-context/definition.js";
import { mcpCallDefinition } from "./tools/mcp-call/definition.js";
import { shellSessionDefinition } from "./tools/shell-session/definition.js";
import { gitWriteDefinition } from "./tools/git-write/definition.js";
import { testRunnerDefinition } from "./tools/test-runner/definition.js";
import { lintFixDefinition } from "./tools/lint-fix/definition.js";
import { webFetchDefinition } from "./tools/web-fetch/definition.js";
import { webSearchDefinition } from "./tools/web-search/definition.js";
import { astSearchDefinition } from "./tools/ast-search/definition.js";
import { memoryStoreDefinition } from "./tools/memory-store/definition.js";
import { envSecretsDefinition } from "./tools/env-secrets/definition.js";
import { imageReadDefinition } from "./tools/image-read/definition.js";
import { browserSnapshotDefinition } from "./tools/browser-snapshot/definition.js";
import { scheduleCronDefinition } from "./tools/schedule-cron/definition.js";
import { sandboxDockerDefinition } from "./tools/sandbox-docker/definition.js";
import { lspBridgeDefinition } from "./tools/lsp-bridge/definition.js";
import { budgetStatusDefinition } from "./tools/budget-status/definition.js";
import { runSubagentDefinition } from "./tools/run-subagent/definition.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toolkitDefinitions: ToolDefinition<any, any>[] = [
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
  mcpCallDefinition,
  shellSessionDefinition,
  gitWriteDefinition,
  testRunnerDefinition,
  lintFixDefinition,
  webFetchDefinition,
  webSearchDefinition,
  astSearchDefinition,
  memoryStoreDefinition,
  envSecretsDefinition,
  imageReadDefinition,
  browserSnapshotDefinition,
  scheduleCronDefinition,
  sandboxDockerDefinition,
  lspBridgeDefinition,
  budgetStatusDefinition,
  runSubagentDefinition,
];
