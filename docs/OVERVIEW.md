# OVERVIEW — spiegato semplice

Immagina il modello come uno stagista bravissimo ma senza mani.
I tool sono le mani.

## Mani che hai già (52)

- Occhi e penna: `read_file, list_directory, find_files, create_file, edit_file, apply_patch, move_file`
- Ctrl+F potenziato: `search_text, search_pro, prepare_context, find_references, go_to_definition, inspect_symbol`
- Dottore del codice TS: `diagnose, typecheck_file, review_code, debug_error`
- Quadernetto: `todo, history, ask_user`
- Fase 3 nuove: `bash_exec` (fornelli, con accept), `count_tokens, chunk_text, pack_context` (non riempirgli la testa)
- Fase 4 nuova: `mcp_call` (il postino MCP: chiama server esterni come web fetch/search via config)
- Fase 5 nuove: `shell_session` (fornelli sempre accesi: dev-server e test lunghi), `git_write` (commit/branch/stash locali, mai push), `test_runner` (pass/fail strutturati), `lint_fix` (ripara invece di solo controllare)
- Fase 6 nuove: `web_fetch` + `web_search` (occhi su internet, con anti-SSRF), `ast_search` (capisce il codice, non solo Ctrl+F), `memory_store` (si ricorda le cose), `env_secrets` (non spiffera le password)
- Fase 7 nuove: `image_read` (vede foto e PDF), `browser_snapshot` (foto di pagine vere), `schedule_cron` (promemoria da solo), `sandbox_docker` (gabbia isolata per codice rischioso)
- Fase 8 nuove: `lsp_bridge` (capisce i tipi davvero via tsserver), `budget_status` (conta i token e taglia oltre il tetto), `run_subagent` (sotto-stagista vero con contesto isolato)

## Lucchetto nuovo (Fase 2)

File `src/core/approval.ts`:
- `read` passa da solo
- `write` ed `execute` chiedono sempre `accept | deny` se c'è un approver collegato
- senza approver (nei test vecchi) tutto resta come prima

File `src/core/policy.ts`:
- aggiunti `execPolicy` e `isDangerousCommand()` che blocca `rm -rf /, mkfs, curl|sh, shutdown...` anche se dici accept

File `src/core/guarded.ts`:
- prima controlla la policy, poi chiede all'umano, poi esegue
- se dici deny torna `NEED_APPROVAL` e non tocca il disco
- tutto scritto in audit con `allow | deny | need_approval`

## Prossimi passi

- Fase 3 fatta: `bash_exec` stretto + `count_tokens, chunk_text, pack_context` nativi
- Fase 4 fatta: `mcp_call` vero via MCP (stdio initialize + list + call, fake echo server per test, web via config)
- Fase 5 fatta: loop dev chiuso (sessioni, git locale, test strutturati, lint fix) + fix permessi spawn
- Fase 6 fatta: conoscenza (web diretto con SSRF-guard, AST search, memoria locale, secrets hygiene)
- Fase 7 fatta: sensi e autonomia (immagini, browser, cron, sandbox) + fix bug todo sempre-deny
- Fase 8 fatta: il cervello (LSP vero, budget globale con tetto, sub-agent veri via Ollama, audit con sessionId)
