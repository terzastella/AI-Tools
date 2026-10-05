# debugger — `debug_error` v1.1 (trova, non indovina)

Niente parole chiave a caso. Solo fatti verificati.

- Input: `errorLog` required, `paths` default `["."]`, `maxCandidates` 1..20 default 5, `applyFix` default false.
- Flusso preciso:
  1. Legge `file:riga` dal log → controlla che il file esiste davvero → `verified:true, score 100`
  2. Lancia `diagnose` → se c'è errore `tsc` stesso file ±2 righe → `+50, verified:true`
  3. Senza stack: usa errori `tsc` veri come candidati
  4. Se zero verificato: hint noto (`AMBIGUOUS/NOT_FOUND`) oppure `NO_CANDIDATE` chiaro — mai finto
- Output: `{ diagnosis: "Trovato in ...", candidates: [{path, line?, score, reason, verified}], patchPreview?, verification? }`.
- `applyFix:true` verifica con revisore acceso (`useDiagnose:true`), non muta codice ignoto.
