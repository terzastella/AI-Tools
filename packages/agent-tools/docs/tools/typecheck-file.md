# typecheck_file — `typecheck_file` v1.0

Stesso meccanico di `diagnose`, foglio piccolo.

- Lancia `tsc --noEmit` sul progetto come `diagnose`, poi filtra gli errori ai soli `paths` richiesti (1..10 file).
- Output: `{ issues, summary: {total, filtered}, files }`. `total` = errori tsc in tutto il progetto, `filtered` = quelli nei tuoi file.
- Limite onesto: stesso tempo di `diagnose`. La velocità vera richiederebbe `typescript` come dipendenza runtime.
