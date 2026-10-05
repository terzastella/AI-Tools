# reviewer — `review_code` v1.1 (dottore dentro, acceso)

Stile + tipi veri insieme. Acceso di default come approvato.

Regole (8): `long-line>120`, `no-console-log`, `todo-fixme`, `no-any` (.ts), `secret-like`, `missing-newline-eof`, `huge-file>2000`, `tsc-error` (errore vero da diagnose).

- Input: `paths` default `["."]`, `includeGlobs`, `excludeGlobs`, `maxFiles` 1..100 default 20, `rules` subset, `useDiagnose` default `true`.
- Se `useDiagnose:true`: chiama `diagnoseLogic` dentro, ogni errore `tsc` diventa `{severity:error, rule:tsc-error}`. Se il dottore fallisce, continua con solo stile + `diagnosed:false`.
- Output: `{ issues, summary, truncated, diagnosed }`.
- Errori: `BAD_ARGS | PATH_TRAVERSAL | NOT_FOUND`.

Esempio:

```ts
await reviewerDefinition.execute({ args: { paths: ["src"] }, ctx });
// veloce ma completo: stile + tsc insieme
await reviewerDefinition.execute({ args: { paths: ["src"], useDiagnose: false }, ctx });
// solo stile, 1 secondo
```
