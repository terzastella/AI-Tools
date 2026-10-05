# search_pro — `search_pro` v1.0 (occhi migliori)

Cerca con testa: titolo file vale 8 punti, cartella 3, ogni parola trovata nel testo vale 1 (max 5 per parola). Ritorna pezzetti di 180 caratteri attorno alla parola.

- Input: `query` richiesta, `paths` default `["."]`, `maxFiles` default 15, `maxSnippets` default 3.
- Salta `node_modules, dist, .git` e file oltre 400KB o binari.
