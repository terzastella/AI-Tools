# list — `list_directory` v1.0 (guardare nei cassetti)

Elenco ordinato (dir prima), solo lettura.

- Input: `path` default `.`, `recursive` default false, `maxEntries` 1..1000 default 100, `includeHidden` default false.
- Output: `{ path, abs, entries: [{name, path, type, size?}], truncated }`.
