# preparer — `prepare_context` v1.0

Pre-tool deterministico, sola lettura. Esplora lo scope e prepara contesto per `create_file` / `edit_file`.

- Input: `goal` (required), `paths` default `["."]`, `includeGlobs`, `excludeGlobs`, `maxFiles` default 20 (1..100), `maxBytesPerFile` default 20000.
- Esclude sempre: `node_modules, dist, .git, coverage, .tmp-demo`. Skip binari (`\0`) e file >500KB.
- Score: boost su filename match + occorrenze keyword nel contenuto. Sort desc, slice a `maxFiles`, `truncated` se eccede.
- Output: `{ goal, files: [{path, abs, bytes, lines, score, snippet}], plan: {steps: [{kind: edit, path, hint}]}, truncated }`.
- Errori: `BAD_ARGS | PATH_TRAVERSAL | NOT_FOUND | PREPARER_FAILED` via `withTiming`, mai throw da `execute()`.

Esempio:

```ts
await preparerDefinition.execute({
  args: { goal: "add retry to writer", paths: ["src"], maxFiles: 10 },
  ctx,
});
// -> files top + plan.steps da passare a editor/writer
```

Flusso consigliato: `prepare_context` → `create_file`/`edit_file` → (futuro) `review_code` → `debug_error`.
