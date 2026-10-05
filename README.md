# AI-Tools

Tools for AI Agents — mani operative per potenziare i modelli con capacità che da soli non hanno.
Solo struttura per ora, niente installer.

## Da dove viene

- `packages/agent-tools/` — copiato da `agent-tools` locale: 31 tool TS `ToolDefinition` + `core` con policy/audit/guard + nuovo approval gate accept/deny.
- `packages/py-ref/` — solo i 4 script Python buoni come riferimento per il port nativo futuro: `token_count, chunker, context_pack, prompt_run`.

## Le 3 regole scelte

- a) Stretta + sempre accept/deny umano. Vedi `packages/agent-tools/src/core/approval.ts` + `guarded.ts`.
- b) Web via MCP (prossimo passo, non ancora implementato).
- c) Nativo: i Python sopra verranno tradotti in TypeScript.

## Uso rapido (per principiante)

Lo stagista AI sa già leggere/scrivere file e cercare nel codice.
Ora prima di ogni scrittura chiede: accept o deny.
Se dici deny, non scrive niente e salva `NEED_APPROVAL` in audit.

## Validazione

Dentro `packages/agent-tools`: `pnpm install`, `pnpm typecheck`, `pnpm test`.

Remoto: https://github.com/terzastella/AI-Tools (privata, push via GitHub App/Desktop).
