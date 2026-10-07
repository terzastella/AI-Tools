# Livelli: core garantito vs estesi

Non tutti i 53 tool hanno la stessa garanzia. Due livelli, dichiarati onestamente:

## Core (15) — garantiti

Il loop minimo di ogni agente + un rappresentante per area. Questi hanno test dedicati,
docs complete e non cambiano nome/contratto senza major version:

`read_file, list_directory, find_files, create_file, edit_file, apply_patch,`
`search_text, ast_search, bash_exec, git, git_write, todo, ask_user, diagnose, test_runner`

In codice: `toolkitCore` in `src/toolkit.ts` (lista `TOOLKIT_CORE_NAMES`).
Test: `tests/levels.test.ts` — cambiarla rompe il test di proposito.

## Estesi (38) — utili, garanzia best-effort

Tutto il resto (38 = 53 − 15). Hanno test e docs, ma contratto e copertura
possono evolvere nelle minor:

- file extra: `edit_many, move_file, rename_symbol, history, file_outline, format_check, check_config, typecheck_file, image_read`
- navigazione: `search_pro, prepare_context, find_references, go_to_definition, inspect_symbol, import_map, lsp_bridge, review_code`
- ragiona: `debug_error, delegate_task, refactor_plan, generate_docs, create_skill`
- testo/RAG: `count_tokens, chunk_text, pack_context`
- esecuzione: `shell_session, lint_fix, sandbox_docker, mcp_call`
- web: `web_fetch, web_search, browser_snapshot`
- memoria/igiene: `memory_store, env_secrets`
- autonomia e controllo: `run_subagent, schedule_cron, budget_status, audit_verify`

## Come scegliere

- Agente nuovo? Parti dal core-15, aggiungi estesi solo quando servono
  (ogni tool in più è contesto in più per il modello).
- In opencode: `"ai-tools_*": "ask"` globali oppure abilita per-agent solo i core.
