# doc-gen — `generate_docs` v1.0

Genera docs da codice, read-only. Compone `prepare_context`, non duplica `read_file`.

- Input: `paths` default `["src"]`, `maxFiles` 1..100, `style` markdown|jsdoc.
- Output: `{ docs: [{path, exports, functions, markdown}], indexMd, truncated }`.
