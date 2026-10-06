# delegate — `delegate_task` (planning-only, NON chiama LLM)

Fa piano furbo, scrive todo in `.agent/todos.json`, verifica ogni file (leggibile + puzze stile). Tutto read-only tranne i todo.

> Per sub-agent veri che ragionano su un modello usa `run_subagent` (contesto isolato, provider Ollama/echo). Questo resta solo planning deterministico.

- Input: `goal` richiesto, `paths` default `["src"]`, `maxSteps` 1..10 default 3.
- Output: `{ goal, steps: [{path, kind, verified, detail}], todoIds, summary }`.
- Prossimo a mano: `edit_file` / `apply_patch` partendo dal primo verificato.
