# diagnose — `diagnose` v1.0 (il dottore vero)

- Sempre: `npx tsc --noEmit` nel `cwd`, parse `file(riga,col): error TS...`.
- Se trova `eslint`: lo lancia in JSON e aggiunge i suoi messaggi (mai blocca se manca).
- Solo se `runTests:true`: lancia `npx vitest run [testPattern]` e aggiunge i `FAIL`.
- Output: `{issues: [{source: tsc|eslint|vitest, path?, line?, col?, message}], summary, ran}`.
- Come opencode: veloce sempre, esami lunghi a richiesta.
