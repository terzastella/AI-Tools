# OVERVIEW — spiegato semplice

Immagina il modello come uno stagista bravissimo ma senza mani.
I tool sono le mani.

## Mani che hai già (31)

- Occhi e penna: `read_file, list_directory, find_files, create_file, edit_file, apply_patch, move_file`
- Ctrl+F potenziato: `search_text, search_pro, prepare_context, find_references, go_to_definition, inspect_symbol`
- Dottore del codice TS: `diagnose, typecheck_file, review_code, debug_error`
- Quadernetto: `todo, history, ask_user`

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

- Fase 3: `bash_exec` stretto + `count_tokens, chunk_text, pack_context` nativi
- Fase 4: `mcp_call` per web via MCP
