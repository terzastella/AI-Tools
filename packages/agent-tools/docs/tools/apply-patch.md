# apply_patch — `apply_patch` v1.0

Unified diff multi-file/multi-hunk con verifica contesto riga-per-riga. Complemento di `edit_file` (single-string): questo fa patch stile `codex apply_patch`.

- Input: `patch` unified diff required, `dryRun` default false, `stripPrefix` default 1.
- Verifica: ogni ` ` e `-` deve matchare l'originale, altrimenti `CONTEXT_MISMATCH`. Errori: `BAD_ARGS | BAD_PATCH | CONTEXT_MISMATCH | PATH_TRAVERSAL | BINARY`.
- Output: `{ files: [{path, hunks, added, removed}], preview, dryRun }`.
