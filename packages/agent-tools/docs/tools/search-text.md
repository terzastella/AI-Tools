# search_text — `search_text` v1.0

Cerca con regex dentro i file. Solo lettura.

- Input: `pattern` regex richiesto, `paths` default `["."]`, `include` glob es. `*.ts`, `maxMatches` 1..200 default 50, `contextLines` 0..3 default 0.
- Salta file >400KB e binari. Output: `{ pattern, matches: [{path, line, col, snippet}], files, truncated }`.
- Errori: `BAD_ARGS | BAD_PATTERN | PATH_TRAVERSAL | NOT_FOUND`.
