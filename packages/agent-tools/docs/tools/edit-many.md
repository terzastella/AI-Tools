# edit_many — `edit_many` v1.0

Fino a 20 modifiche in un colpo, atomico: o tutte o nessuna.

- Input: `edits: [{path, oldString, newString, replaceAll?}]`, `dryRun` default false.
- Verifica prima tutti i match (rifiuta ambigui senza `replaceAll`), poi scrive con tmp+rename.
- Output: `{ applied: [{path, abs, replacements}], dryRun, preview }`.
- Errori: `BAD_ARGS | NOOP | PATH_TRAVERSAL | NOT_FOUND | CONTEXT_MISMATCH | AMBIGUOUS`.
