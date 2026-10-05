# skill creator — `create_skill` v1.0

Meta-tool: genera un nuovo tool conforme al core.

- Input: `name` snake_case required, `description` required, `label`, `category` default `other`, `write` default false, `dir` default `src/tools`.
- Dry-run (`write:false`): ritorna 5 file (`logic.ts, definition.ts, permissions.ts, index.ts, tests/<name>.test.ts` stub) + `definitionSnippet` + `nextSteps`, senza scrivere.
- `write:true`: scrive i 4 core via `writerLogic` + `docs/tools/<name>.md`. Rifiuta collisioni (`create_file, edit_file, prepare_context, review_code, debug_error, create_skill`) e nomi non snake_case.
- Errori: `BAD_ARGS | COLLISION | PATH_TRAVERSAL`.

Esempio:

```ts
await skillCreatorDefinition.execute({ args: { name: "summarize_code", description: "Summarize code" }, ctx });
```
