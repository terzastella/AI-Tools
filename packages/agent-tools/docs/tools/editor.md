# editor — `edit_file` v1.0

Modifica chirurgica su file esistente.

Modes:
- `replace` (default): richiede `oldString + newString`. Se match >1 senza `replaceAll:true` → errore `AMBIGUOUS`. Se 0 match → `NOT_FOUND_STRING`.
- `insertAt`: `line (1-indexed) + content`. `line = n+1` appende.
- `deleteRange`: `startLine + endLine` inclusivi.

Flags: `backup=false` (se true scrive `.bak`), `dryRun=false` (preview senza scrivere).

Output: `{ path, abs, mode, bytes, replacements?, preview, backupPath? }`.

Esempio:

```ts
await editorDefinition.execute({
  args: { path: "src/hello.ts", oldString: "const x = 1", newString: "const x = 2" },
  ctx,
});
```
