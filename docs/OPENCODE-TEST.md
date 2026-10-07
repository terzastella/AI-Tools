# Testare i 53 tool dentro opencode (5 task)

Sostituisci `<PATH-REPO>` con il path di questa repo e `<PATH-TUO-PROGETTO>` con un progetto prova.
Copia `examples/opencode.json` nel tuo `opencode.json` (glob `ai-tools_*` già su `ask`: opencode chiede lui, il server gira policy-only).

Segna pass/fail per ogni task e riporta qui cosa si rompe: torna in fix nel repo.

## T1 — leggere + modificare (read_file, edit_file, ask_user)

Prompt: `usa ai-tools: leggi src/math.ts, poi chiedimi con ask_user se aggiungere la divisione`
- [ ] Legge e mostra il file
- [ ] `ask_user` apre davvero la domanda con opzioni
- [ ] Dopo accept, modifica solo con edit mirato

## T2 — cercare e capire (search_text, ast_search, lsp_bridge)

Prompt: `usa ai-tools: trova dove è definita somma e tutti i suoi usi`
- [ ] `ast_search` trova la definizione con riga
- [ ] `lsp_bridge references` trova definizione + usi cross-file
- [ ] Niente allucinazioni sui path

## T3 — test e fix (test_runner, diagnose, lint_fix)

Prompt: `usa ai-tools: lancia i test di src/ e se c'è un errore spiegalo con diagnose`
- [ ] `test_runner` torna pass/fail strutturati
- [ ] `diagnose` trova errori tsc veri

## T4 — web (web_fetch, web_search)

Prompt: `usa ai-tools: cerca la doc di Array.prototype.flat e riassumi i primi 2 risultati`
- [ ] `web_search` torna titolo+url
- [ ] `web_fetch` rende testo leggibile con budget

## T5 — memoria (memory_store, todo)

Prompt: `usa ai-tools: ricordati che preferisco commit brevi, poi metti in todo i prossimi 2 passi`
- [ ] `memory_store put` + `search` ritrova la nota
- [ ] `todo` add/list funzionano via MCP (fix dominio Fase 7)

## Note

- 53 tool = tanto contesto: se opencode si lamenta del context, disabilita a gruppi con `"ai-tools_*": false` + abilita per agent solo quelli del task (parti dal core-15 in `docs/LEVELS.md`).
- `delegate_task` è planning-only: per sub-agent in opencode usa il suo Task, oppure `run_subagent` (richiede Ollama locale).
