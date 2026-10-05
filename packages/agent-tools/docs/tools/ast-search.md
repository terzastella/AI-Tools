# ast_search

Cerca simboli strutturali invece di testo grezzo: `function/class/interface/import` con nome, riga e snippet. Su TS/JS usa AST TypeScript vera quando il modulo è disponibile, altrimenti regex mirati (anche Python). Salta `node_modules/dist/.git`.
