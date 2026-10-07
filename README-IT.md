<div align="center">

# 🛠️ AI-Tools

**52 tool safety-first che danno a qualsiasi modello AI delle mani.**

*File, terminale, git, web, memoria, LSP, MCP e budget — un solo registry, zero dipendenze runtime.*

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node: 20+](https://img.shields.io/badge/node-20+-blue.svg)](packages/agent-tools/package.json)
[![CI](https://github.com/terzastella/AI-Tools/actions/workflows/ci.yml/badge.svg)](https://github.com/terzastella/AI-Tools/actions)
[![Versione](https://img.shields.io/badge/versione-0.17.0-orange.svg)](packages/agent-tools/package.json)

*English? Read [README.md](README.md) · Catalogo macchina: [catalog/tools.json](catalog/tools.json)*

</div>

---

## Perché un altro toolkit?

Quasi tutte le raccolte aggiungono la sicurezza dopo. Qui è la fondamenta:

- 🔒 **Cancello di approvazione integrato** — letture libere, ogni scrittura ed esecuzione chiede a un umano (`accept | deny`). Deny significa `NEED_APPROVAL` e non viene toccato niente.
- 📝 **Audit di default** — ogni chiamata è loggata append-only con session id. Puoi sempre ricostruire cosa ha fatto l'agente.
- ↔️ **MCP in entrambe le direzioni** — un client per chiamare server esterni *e* un server che espone tutti i 52 tool a opencode e agenti MCP.
- 📦 **Zero dipendenze runtime** — solo Node 20+. TypeScript strict, testato con vitest, CI a ogni push.

## Indice

- [Uso rapido](#uso-rapido)
- [Usarli dentro opencode](#usarli-dentro-opencode-o-agenti-mcp)
- [I 52 tool](#i-52-tool)
- [Come funziona la sicurezza](#come-funziona-la-sicurezza)
- [Privacy](#privacy-cosa-resta-sul-tuo-pc)
- [Validazione](#validazione)
- [Stato](#stato)

## Uso rapido

Semplice:

```ts
import { toolkitDefinitions } from "ai-toolkit";
for (const def of toolkitDefinitions) registry.register(def);
```

Sicuro (consigliato) — policy + audit + il tuo bottone umano:

```ts
import { wrapDefinition, standardPolicy } from "ai-toolkit";

registry.register(wrapDefinition(writerDefinition, { policy: standardPolicy, audit }));
// ctx.approver = async () => "accept" | "deny";
```

> Esempi funzionanti: [`register.ts`](packages/agent-tools/examples/register.ts) · [`secure-register.ts`](packages/agent-tools/examples/secure-register.ts) · [`addon.json`](packages/agent-tools/examples/addon.json)

## Usarli dentro opencode (o agenti MCP)

Niente codice: server MCP stdio in [`servers/ai-tools-mcp/`](servers/ai-tools-mcp/) che espone i 52 tool.

**1.** Compila una volta (produce `dist/`, ignorata da git):

```sh
cd packages/agent-tools && pnpm build
```

**2.** Copia [`examples/opencode.json`](examples/opencode.json) nel tuo `opencode.json` e imposta i due path. Permessi già su `ask`:

```json
{
  "mcp": {
    "ai-tools": {
      "type": "local",
      "command": ["node", "<REPO>/servers/ai-tools-mcp/server.mjs"],
      "environment": { "AI_TOOLS_CWD": "<TUO-PROGETTO>" },
      "enabled": true
    }
  },
  "permission": { "ai-tools_*": "ask" }
}
```

**3.** Segui il piano di test con 5 task in [`docs/OPENCODE-TEST.md`](docs/OPENCODE-TEST.md).

## I 52 tool

> Clicca una famiglia per espanderla. Una pagina per tool in [`packages/agent-tools/docs/tools/`](packages/agent-tools/docs/tools/).

<details>
<summary><b>📁 File (14)</b> — crea, modifica, leggi, sposta, ispeziona</summary>

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

</details>

<details>
<summary><b>🔎 Cerca e capisci codice (9)</b> — ricerca, AST, LSP vero</summary>

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

</details>

<details>
<summary><b>⚙️ Esegui (5)</b> — senza shell, gated, isolato</summary>

| Tool | Fa |
|---|---|
| `bash_exec` | Un comando, senza shell, con timeout |
| `shell_session` | Processi lunghi: start/poll/kill/list |
| `test_runner` | vitest/pytest/npm → pass/fail strutturati |
| `lint_fix` | `eslint --fix` gated |
| `sandbox_docker` | Comando in container isolato (no rete) |

</details>

<details>
<summary><b>🌿 Git (2)</b> — leggi libero, scrivi in locale</summary>

| Tool | Fa |
|---|---|
| `git` | status/diff/log/branch/blame (solo lettura) |
| `git_write` | add/commit/branch/checkout/stash (mai push: lo fai tu dall'App) |

</details>

<details>
<summary><b>🧠 Ragiona e organizza (13)</b> — pianifica, revisiona, delega</summary>

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

</details>

<details>
<summary><b>✂️ Testo e RAG (3)</b> — misura, taglia, impacchetta</summary>

| Tool | Fa |
|---|---|
| `count_tokens` | Stima token chars/4 |
| `chunk_text` | Chunk con overlap |
| `pack_context` | File → contesto con budget |

</details>

<details>
<summary><b>🌐 Web e integrazioni (4)</b> — fetch, cerca, browser, MCP</summary>

| Tool | Fa |
|---|---|
| `web_fetch` | Pagina pubblica → testo (anti-SSRF) |
| `web_search` | Cerca senza chiavi (best-effort) |
| `browser_snapshot` | Pagina renderizzata via Chrome/Edge headless |
| `mcp_call` | Chiama server MCP via stdio |

</details>

<details>
<summary><b>💾 Memoria e igiene (2)</b> — ricorda, non spiffera</summary>

| Tool | Fa |
|---|---|
| `memory_store` | Memoria locale `.agent/memory` (put/get/search) |
| `env_secrets` | Check senza rivelare + redact (read-only) |

</details>

> `delegate_task` è planning deterministico (non chiama modelli). Per far ragionare davvero un sotto-agente usa `run_subagent`.

## Come funziona la sicurezza

```
modello ──▶ opencode / MCP ──▶ guard ──▶ 52 tool
                                  │
              ┌───────────────────┼───────────────┐
              ▼                   ▼               ▼
           policy             approval        audit + budget
     (fail-closed,          (umano         (append-only,
      deny vince)         accept|deny)      session id, tetto)
```

- **Fail-closed**: deny vince sempre, senza allow esplicito non passa niente.
- **Comandi pericolosi** (`rm -rf /`, `mkfs`, `curl|sh`…) bloccati anche con accept.
- **Path** sempre dentro la working directory; **URL privati** bloccati; **secrets** mai nei log.

## Privacy: cosa resta sul tuo PC

- Nel repo finiscono solo codice, docs e test. Mai contenuti tuoi.
- Tutto ciò che i tool scrivono mentre lavorano (`audit`, `history`, `todos`, `memory`, `schedule`, `budget`) vive in `.agent/`, ignorata da git.
- Gli output includono i path del tuo disco e gli audit salvano il `cwd`: restano locali — mai committare `.agent/`.

## Validazione

```sh
cd packages/agent-tools
pnpm install
pnpm typecheck
pnpm test
```

La CI gira install + typecheck + build + test a ogni push ([workflow](.github/workflows/ci.yml)).

## Stato

**v0.17.0** — 52 tool hardened (symlink/realpath, env scrubbed, redirect rivalidati), 8 fasi + hardening. Storia completa in `git log`. MIT ([LICENSE](LICENSE)).
