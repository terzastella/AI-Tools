# goto — `go_to_definition` v1.0 (seguire il filo)

Trova dove nasce un simbolo: `export function/const/class/interface`. Prima gli import del file chiamante, poi gli export.

- Input: `symbol` richiesto, `fromFile?`, `paths` default `["."]`, `maxResults` default 5.
- Output: `{ symbol, locations: [{path, line, col, snippet, kind}] }`.
