**Project in MANITENCE** | 06-10-2026

# AI-Tools — mani operative per Agenti AI

52 tool TypeScript reali (`ToolDefinition` + `registry.register`) che danno a un modello le capacità che da solo non ha: file, terminale, git, web, memoria, LSP, MCP, budget. MIT, di `terzastella`.

Spiegazione semplice in `docs/OVERVIEW.md`. Catalogo macchina in `catalog/tools.json`.

## Le 3 regole

- **Stretta + sempre accept/deny umano** — letture libere, scritture ed esecuzioni chiedono sempre (`src/core/approval.ts` + `guarded.ts`). Comandi pericolosi bloccati anche con accept.
- **Web anche via MCP** — `web_fetch/web_search` diretti + `mcp_call` per server esterni standard.
- **Nativo, zero dipendenze runtime** — solo Node 20+, test con vitest.

## Uso rapido

```ts
import { toolkitDefinitions } from "ai-toolkit"; // o singoli: writerDefinition, ...
for (const def of toolkitDefinitions) registry.register(def);
```

Sicuro di default:

```ts
import { wrapDefinition } from "ai-toolkit";
import { standardPolicy } from "ai-toolkit";
registry.register(wrapDefinition(writerDefinition, { policy: standardPolicy, audit }));
// ctx.approver = async () => "accept" | "deny"  <- il tuo bottone umano
```

Esempi in `packages/agent-tools/examples/` (`register.ts`, `secure-register.ts`, `addon.json`, `mcp-servers.json`, `opencode.json`).

## Usarli dentro opencode (o agenti MCP)

Niente codice: server MCP stdio in `servers/ai-tools-mcp/` che espone i 52 tool.

```sh
cd packages/agent-tools && pnpm build   # serve dist/
```

 poi copia `examples/opencode.json` nel tuo `opencode.json` (cambia i due path) — glob `ai-tools_*` già su `ask`.
Piano di test con 5 task in `docs/OPENCODE-TEST.md`. Dettagli server in `servers/ai-tools-mcp/README.md`.

## I 52 tool

### File (14)

| Tool | Fa |
|---|---|
| `create_file` | Crea file atomico |
| `edit_file` | Modifica chirurgica (replace/insert/delete) |
| `edit_many` | Batch atomico multi-file |
| `apply_patch` | Unified diff multi-hunk |
| `read_file` | Legge a pagine (offset/limit) |
| `list_directory` | Elenca cartelle |
| `find_files` | Glob per nome |
| `move_file` | move/copy/delete |
| `rename_symbol` | Rename whole-word |
| `history` | Versioni file in `.agent/history` |
| `file_outline` | Indice simboli di un file |
| `format_check` | Controlla stile (read-only) |
| `check_config` | Valida package.json/tsconfig |
| `image_read` | png/jpg/webp/gif/pdf → base64 (+testo best-effort PDF) |

### Cerca e capisci codice (9)

| Tool | Fa |
|---|---|
| `search_text` | Regex nei file |
| `search_pro` | Ricerca con ranking |
| `prepare_context` | Contesto per goal |
| `find_references` | Chi usa questo simbolo (regex) |
| `go_to_definition` | Dov'è definito (regex+import) |
| `inspect_symbol` | Dettaglio simbolo |
| `import_map` | Chi importa cosa |
| `ast_search` | Simboli strutturali (AST TS o regex mirati) |
| `lsp_bridge` | Vero tsserver: hover, references, rename dry |

### Esegui (5)

| Tool | Fa |
|---|---|
| `bash_exec` | Un comando, senza shell, con timeout |
| `shell_session` | Processi lunghi: start/poll/kill/list |
| `test_runner` | vitest/pytest/npm → pass/fail strutturati |
| `lint_fix` | `eslint --fix` gated |
| `sandbox_docker` | Comando in container isolato (no rete) |

### Git (2)

| Tool | Fa |
|---|---|
| `git` | status/diff/log/branch/blame (solo lettura) |
| `git_write` | add/commit/branch/checkout/stash (mai push: lo fai tu dall'App) |

### Ragiona e organizza (13)

| Tool | Fa |
|---|---|
| `todo` | Lista passi in `.agent/todos.json` |
| `ask_user` | Domanda all'umano con opzioni |
| `delegate_task` | Planning-only (NON chiama LLM — vedi sotto) |
| `run_subagent` | Sub-agent vero con contesto isolato (Ollama/echo) |
| `refactor_plan` | Piano eseguibile, non esegue |
| `review_code` | Revisione con regole + diagnose |
| `debug_error` | Da stack trace a candidati + fix |
| `diagnose` | tsc+eslint+vitest aggregati |
| `typecheck_file` | tsc filtrato |
| `generate_docs` | Docs da codice |
| `create_skill` | Scaffold di un nuovo tool |
| `schedule_cron` | Promemoria schedulati (add/list/remove/due) |
| `budget_status` | Contatore token globale + tetto |

### Testo e RAG (3)

| Tool | Fa |
|---|---|
| `count_tokens` | Stima token chars/4 |
| `chunk_text` | Chunk con overlap |
| `pack_context` | File → contesto con budget |

### Web e integrazioni (4)

| Tool | Fa |
|---|---|
| `web_fetch` | Pagina pubblica → testo (anti-SSRF) |
| `web_search` | Cerca senza chiavi (best-effort) |
| `browser_snapshot` | Pagina renderizzata via Chrome/Edge headless |
| `mcp_call` | Chiama server MCP via stdio |

### Memoria e igiene (2)

| Tool | Fa |
|---|---|
| `memory_store` | Memoria locale `.agent/memory` (put/get/search) |
| `env_secrets` | Check senza rivelare + redact (read-only) |

> `delegate_task` è planning deterministico (non chiama modelli). Per far ragionare davvero un sotto-agente usa `run_subagent`.

Dettaglio di ognuno in `packages/agent-tools/docs/tools/*.md`.

## Sicurezza in breve

- Fail-closed: deny vince sempre, senza allow esplicito niente passa (`src/core/policy.ts`).
- `write/execute` chiedono `accept | deny`; `deny` → `NEED_APPROVAL`, niente toccato.
- Audit append-only in `.agent/audit/*.jsonl` con `sessionId`.
- Budget token globale con tetto opzionale (`BUDGET_EXCEEDED`).
- Path sempre dentro cwd (anti-traversal), URL privati bloccati, secrets mai nei log.

## Validazione

```sh
cd packages/agent-tools
pnpm install
pnpm typecheck
pnpm test
```

CI su ogni push (`.github/workflows/ci.yml`): install + typecheck + test.

## Stato

v0.16.0 — 52 tool, 8 fasi (base → lucchetto → exec+nativi → MCP → loop dev → conoscenza → sensi → cervello). Storia in `git log`.
