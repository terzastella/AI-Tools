# find_files — `find_files` v1.0

Trova file per nome con jolly. Solo lettura.

- Input: `pattern` richiesto (relativo, senza `..`), `paths` default `["."]`, `maxFiles` 1..200 default 50, `includeHidden` default false.
- Jolly: `*` dentro un pezzo, `**` tutte le sottocartelle, `?` un carattere. Salta `node_modules, dist, .git, coverage, .agent`.
- Output: `{ pattern, matches: [{path, abs}], truncated }`.
- Errori: `BAD_ARGS | PATH_TRAVERSAL | NOT_FOUND`.
