# format_check — `format_check` v1.0

Solo bella copia meccanica. Solo lettura, il fix resta a `edit_file`.

- Regole: `trailing-space`, `tab-indent`, `mixed-eol`, `missing-eof-newline`, `double-blank`.
- Input: `paths` default `["."]`, `maxFiles` 1..100 default 20, `rules` subset.
- Output: `{ issues: [{path, line, rule, message}], summary, truncated }`.
