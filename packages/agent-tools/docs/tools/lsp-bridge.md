# lsp_bridge

Vero language-server TypeScript: `hover` (tipo di un simbolo), `references` cross-file, `rename` dry (propone le modifiche, le applichi tu con `edit_many`). Posizione con `path + line + character` (o `symbol` per trovare la colonna). Se manca il modulo typescript torna `TYPESCRIPT_MISSING` (fallback: `goto/refs`).
