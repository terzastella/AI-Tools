# delegate — `delegate_task` v1.0 (capo-cantiere, non scrive codice)

Fa piano furbo, scrive todo in `.agent/todos.json`, verifica ogni file (leggibile + puzze stile). Tutto read-only tranne i todo.

- Input: `goal` richiesto, `paths` default `["src"]`, `maxSteps` 1..10 default 3.
- Output: `{ goal, steps: [{path, kind, verified, detail}], todoIds, summary }`.
- Prossimo a mano: `edit_file` / `apply_patch` partendo dal primo verificato.
