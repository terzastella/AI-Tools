# refs — `find_references` v1.0 (dove viene usata)

Il contrario di `go_to_definition`: data una funzione, trova tutti i posti che la usano. Salta la riga `export` (quella la trova goto).

- Input: `symbol` richiesto, `paths` default `["."]`, `maxFiles` default 20, `maxMatches` default 50.
- Output: `{ symbol, matches: [{path, line, col, snippet}], files, truncated }`.
