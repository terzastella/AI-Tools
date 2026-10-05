# refactor_plan — `refactor_plan` v1.1 (furbo ma semplice)

Piano con misure precise, non lista generica.

- Prima i rotti veri: `errori tsc ×5 + puzze ×2 + punti ricerca`. Un file rotto passa avanti a uno solo simile.
- Attrezzo giusto: `edit` singolo, `patch` se 3+ problemi o 2+ errori tsc, `rename` solo se parli di nomi.
- Hint con riga: `src/a.ts riga 10 — Type ... Apri e fai edit_file`.
- Rischi veri: secrets, tocca test, contesto troncato.

- Input: `goal` required, `paths` default `["src"]`, `maxSteps` 1..20 default 5.
- Output: `{ goal, steps: [{kind: edit|patch|rename, path, hint, priority}], risks[] }`.
