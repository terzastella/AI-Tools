# ask_user — `ask_user` v1.0

Ferma il robot e chiede all'umano. Non tocca disco.

- Input: `question` richiesta, `options` 2..6 voci `{label, description?}`, `multi` default false.
- Output: `{ question, options, multi, hint }`. L'agente esterno mostra la UI e reinietta la scelta.
