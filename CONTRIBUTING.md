# Contributing

Poche regole, niente burocrazia.

## Come contribuire

1. Apri una issue prima (bug o proposta tool) o vai dritto con una PR piccola.
2. Un tool = 4 file in `packages/agent-tools/src/tools/<nome>/`
   (`definition.ts`, `logic.ts`, `permissions.ts`, `index.ts`) + test in
   `packages/agent-tools/tests/` + pagina in `packages/agent-tools/docs/tools/`
   (il test `docs-coverage` lo pretende).
3. Mai throw raw dalle logic: sempre `ok/fail` con codice errore.
4. Nuovi domini di permesso solo se serve (vedi `docs/LEVELS.md` per i livelli).
5. Prima di pushare: `pnpm typecheck` e `pnpm test` verdi in `packages/agent-tools`.
6. Aggiorna `CHANGELOG.md` sotto `[Unreleased]`.

## Bug di sicurezza

NON aprire issue pubbliche: vedi `SECURITY.md`.
