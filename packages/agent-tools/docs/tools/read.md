# read — `read_file` v1.0 (apri alla pagina giusta)

Legge a pezzi, solo lettura.

- Input: `path` richiesto, `offset` da 1 default 1, `limit` 1..1000 default 200.
- Output: `{ path, abs, lines, totalLines, offset, truncated }`.
- Errori: `BAD_ARGS | PATH_TRAVERSAL | NOT_FOUND | BINARY | TOO_BIG (>500KB)`.
