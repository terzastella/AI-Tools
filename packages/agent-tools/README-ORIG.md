# AI-Toolkit v0.10 — sicurezza: bloccare + audit su file

Tool nativi TS per agent custom. Addon plain (`installPlainTools` + `registry.register`), MCP solo via config futura. Policy enforce + audit `.agent/audit/` di default.

## Tool (31)
- `create_file` (writer v1.0) — vedi `docs/tools/writer.md`
- `edit_file` (editor v1.0) — vedi `docs/tools/editor.md`
- `prepare_context` (preparer v1.0) — vedi `docs/tools/preparer.md`
- `review_code` (reviewer v1.0) — vedi `docs/tools/reviewer.md`
- `debug_error` (debugger v1.0) — vedi `docs/tools/debugger.md`
- `create_skill` (skill-creator v1.0) — vedi `docs/tools/skill-creator.md`
- `apply_patch` (v1.0) — unified diff multi-hunk, vedi `docs/tools/apply-patch.md`
- `generate_docs` (v1.0) — docs da codice, vedi `docs/tools/doc-gen.md`
- `refactor_plan` (v1.0) — piano eseguibile, vedi `docs/tools/refactor-plan.md`
- `find_files` (v1.0) — glob per nome, vedi `docs/tools/find-files.md`
- `search_text` (v1.0) — regex nei file, vedi `docs/tools/search-text.md`
- `edit_many` (v1.0) — batch atomico, vedi `docs/tools/edit-many.md`
- `file_outline` (v1.0) — indice file, vedi `docs/tools/file-outline.md`
- `inspect_symbol` (v1.0) — info mirata, vedi `docs/tools/inspect-symbol.md`
- `import_map` (v1.0) — chi importa cosa, vedi `docs/tools/import-map.md`
- `check_config` (v1.0) — package/tsconfig, vedi `docs/tools/check-config.md`
- `ask_user` (v1.0) — domanda all'umano, vedi `docs/tools/ask-user.md`
- `format_check` (v1.0) — bella copia meccanica, vedi `docs/tools/format-check.md`
- `history` (v1.0) — foto versionate, vedi `docs/tools/history.md`
- `typecheck_file` (v1.0) — tsc filtrato, vedi `docs/tools/typecheck-file.md`
- `git` esteso (branch/blame/staged readonly) — vedi `docs/tools/git.md`

## Sviluppo
```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Integrazione agent
```ts
import { toolkitDefinitions } from "ai-toolkit";
// o singoli: writerDefinition, editorDefinition, preparerDefinition, reviewerDefinition, debuggerDefinition, skillCreatorDefinition, applyPatchDefinition, docGenDefinition, refactorPlanDefinition
for (const def of toolkitDefinitions) registry.register(def); // retry already registered già nel core
```
Vedi `examples/register.ts`, `examples/addon.json`, `examples/mcp-servers.json` (solo config futura, non attiva).

## Roadmap
- V0.7 sicurezza dopo velocità: policy/audit/sandbox.
- `ALTRI ESEMPI più AVANTI` da IDEA.md da definire.
