# import_map — `import_map` v1.0

Mappa chi importa cosa. Solo lettura, utile prima di `move_file`.

- Input: `paths` default `["src"]`, `maxFiles` 1..500 default 100.
- Legge prime 50 righe per file, risolve import relativi. Output: `{ nodes: [{path, imports}], files, truncated }`.
