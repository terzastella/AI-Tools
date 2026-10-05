# file_outline — `file_outline` v1.0

Indice di un file senza leggerlo tutto. Solo lettura.

- Input: `path` richiesto, `maxSymbols` 1..500 default 100.
- Riconosce import, function, class, interface/type/enum, const. Output: `{ path, abs, symbols: [{name, line, kind}], truncated }`.
- Errori: `BAD_ARGS | PATH_TRAVERSAL | NOT_FOUND | NOT_FILE | BINARY | TOO_BIG`.
