<div align="center">

# AI-Tools

**53 safety-first tools that give any AI model hands.**

*Files, terminal, git, web, memory, LSP, MCP and budget — one registry, zero runtime dependencies.*

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node: 20+](https://img.shields.io/badge/node-20+-blue.svg)](packages/agent-tools/package.json)
[![CI](https://github.com/terzastella/AI-Tools/actions/workflows/ci.yml/badge.svg)](https://github.com/terzastella/AI-Tools/actions)
[![Core](https://img.shields.io/badge/core--15-guaranteed-blue.svg)](docs/LEVELS.md)

*🇮🇹 Italiano? Leggi [README-IT.md](README-IT.md) · Machine catalog: [catalog/tools.json](catalog/tools.json)*

</div>

---

## Why another toolkit?

Most tool collections bolt safety on afterwards. Here it is the foundation:

- 🔒 **Approval gate built in** — reads are free, every write and execution asks a human (`accept | deny`). Deny means `NEED_APPROVAL` and nothing is touched.
- 📝 **Audit by default** — every call is logged append-only with session id. You can always reconstruct what the agent did.
- ↔️ **MCP both ways** — a client to call external servers *and* a server exposing all 53 tools to opencode and MCP-compatible agents.
- 📦 **Zero runtime dependencies** — Node 20+ only. TypeScript strict, tested with vitest, CI on every push.

## Contents

- [Quick start](#quick-start)
- [Use inside opencode](#use-inside-opencode-or-any-mcp-agent)
- [The 53 tools](#the-53-tools)
- [How safety works](#how-safety-works)
- [Privacy](#privacy-what-stays-on-your-pc)
- [Validation](#validation)
- [Status](#status)

## Quick start

Plain:

```ts
import { toolkitDefinitions } from "ai-toolkit";
for (const def of toolkitDefinitions) registry.register(def);
```

Secure (recommended) — policy + audit + your human button:

```ts
import { wrapDefinition, standardPolicy } from "ai-toolkit";

registry.register(wrapDefinition(writerDefinition, { policy: standardPolicy, audit }));
// ctx.approver = async () => "accept" | "deny";
```

> Working examples: [`register.ts`](packages/agent-tools/examples/register.ts) · [`secure-register.ts`](packages/agent-tools/examples/secure-register.ts) · [`addon.json`](packages/agent-tools/examples/addon.json)

## Use inside opencode (or any MCP agent)

No code — a stdio MCP server exposing all 53 tools lives in [`servers/ai-tools-mcp/`](servers/ai-tools-mcp/).

**1.** Build once (produces `dist/`, git-ignored):

```sh
cd packages/agent-tools && pnpm build
```

**2.** Copy [`examples/opencode.json`](examples/opencode.json) into your `opencode.json` and set the two paths. Permissions are already on `ask`:

```json
{
  "mcp": {
    "ai-tools": {
      "type": "local",
      "command": ["node", "<REPO>/servers/ai-tools-mcp/server.mjs"],
      "environment": { "AI_TOOLS_CWD": "<YOUR-PROJECT>" },
      "enabled": true
    }
  },
  "permission": { "ai-tools_*": "ask" }
}
```

**3.** Follow the 5-task test plan in [`docs/OPENCODE-TEST.md`](docs/OPENCODE-TEST.md) to verify the integration.

## The 53 tools

> Guaranteed core-15 for new agents — see [`docs/LEVELS.md`](docs/LEVELS.md).

> Click a family to expand. One page per tool in [`packages/agent-tools/docs/tools/`](packages/agent-tools/docs/tools/).

<details>
<summary><b>📁 Files (14)</b> — create, edit, read, move, inspect</summary>

| Tool | Does |
|---|---|
| `create_file` | Atomic file creation |
| `edit_file` | Surgical edits (replace/insert/delete) |
| `edit_many` | Atomic multi-file batch |
| `apply_patch` | Multi-hunk unified diff |
| `read_file` | Paged reads (offset/limit) |
| `list_directory` | Lists directories |
| `find_files` | Glob by name |
| `move_file` | move/copy/delete |
| `rename_symbol` | Whole-word rename |
| `history` | File versions in `.agent/history` |
| `file_outline` | Symbol index of a file |
| `format_check` | Style check (read-only) |
| `check_config` | Validates package.json/tsconfig |
| `image_read` | png/jpg/webp/gif/pdf → base64 (+best-effort PDF text) |

</details>

<details>
<summary><b>🔎 Find and understand code (9)</b> — search, AST, real LSP</summary>

| Tool | Does |
|---|---|
| `search_text` | Regex across files |
| `search_pro` | Ranked search |
| `prepare_context` | Context for a goal |
| `find_references` | Who uses this symbol (regex) |
| `go_to_definition` | Where it is defined (regex+imports) |
| `inspect_symbol` | Symbol details |
| `import_map` | Who imports what |
| `ast_search` | Structural symbols (TS AST or targeted regex) |
| `lsp_bridge` | Real tsserver: hover, references, dry rename |

</details>

<details>
<summary><b>⚙️ Execute (5)</b> — no shell, gated, isolated</summary>

| Tool | Does |
|---|---|
| `bash_exec` | One command, no shell, with timeout |
| `shell_session` | Long processes: start/poll/kill/list |
| `test_runner` | vitest/pytest/npm → structured pass/fail |
| `lint_fix` | Gated `eslint --fix` |
| `sandbox_docker` | Command in isolated container (no network) |

</details>

<details>
<summary><b>🌿 Git (2)</b> — read freely, write locally</summary>

| Tool | Does |
|---|---|
| `git` | status/diff/log/branch/blame (read-only) |
| `git_write` | add/commit/branch/checkout/stash (never push — you do that in the App) |

</details>

<details>
<summary><b>🧠 Reason and organize (13)</b> — plan, review, delegate</summary>

| Tool | Does |
|---|---|
| `todo` | Step list in `.agent/todos.json` |
| `ask_user` | Question to the human with options |
| `delegate_task` | Planning-only (calls no LLMs — see below) |
| `run_subagent` | Real sub-agent, isolated context (Ollama/echo) |
| `refactor_plan` | Executable plan, doesn't execute |
| `review_code` | Rule-based review + diagnose |
| `debug_error` | Stack trace to candidates + fix |
| `diagnose` | Aggregated tsc+eslint+vitest |
| `typecheck_file` | Filtered tsc |
| `generate_docs` | Docs from code |
| `create_skill` | New-tool scaffold |
| `schedule_cron` | Scheduled reminders (add/list/remove/due) |
| `budget_status` | Global token counter + cap |

</details>

<details>
<summary><b>✂️ Text and RAG (3)</b> — measure, chunk, pack</summary>

| Tool | Does |
|---|---|
| `count_tokens` | Token estimate chars/4 |
| `chunk_text` | Overlapped chunks |
| `pack_context` | Files → context with budget |

</details>

<details>
<summary><b>🌐 Web and integrations (4)</b> — fetch, search, browser, MCP</summary>

| Tool | Does |
|---|---|
| `web_fetch` | Public page → text (anti-SSRF) |
| `web_search` | Keyless search (best-effort) |
| `browser_snapshot` | Headless Chrome/Edge rendered page |
| `mcp_call` | Calls MCP servers over stdio |

</details>

<details>
<summary><b>💾 Memory and hygiene (2)</b> — remember, never leak</summary>

| Tool | Does |
|---|---|
| `memory_store` | Local memory in `.agent/memory` (put/get/search) |
| `env_secrets` | Check without revealing + redact (read-only) |
| `audit_verify` | Verifies the audit hash-chain (read-only) |

</details>

> `delegate_task` is deterministic planning (calls no models). For a sub-agent that really reasons, use `run_subagent`.

## How safety works

```
model ──▶ opencode / MCP ──▶ guard ──▶ 53 tools
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
           policy         approval          audit + budget
     (fail-closed,      (human            (append-only,
      deny wins)      accept|deny)         session id, cap)
```

- **Fail-closed**: deny always wins; nothing passes without an explicit allow.
- **Dangerous commands** (`rm -rf /`, `mkfs`, `curl|sh`…) are blocked even on accept.
- **Paths** always stay inside the working directory; **private URLs** blocked; **secrets** never in logs.

## Privacy: what stays on your PC

- The repo only ever gets code, docs and tests. Never your content.
- Everything tools write while working (`audit`, `history`, `todos`, `memory`, `schedule`, `budget`) lives in `.agent/`, ignored by git.
- Outputs include your disk paths and audits store the working directory: they stay local — never commit `.agent/`.

## Validation

```sh
cd packages/agent-tools
pnpm install
pnpm typecheck
pnpm test
```

CI runs install + typecheck + build + test on every push ([workflow](.github/workflows/ci.yml)).

## Status

**v0.18.0** — 53 tools: hardened core (symlinks, env, redirects), chained audit, guaranteed core-15. Full history in `git log`. MIT ([LICENSE](LICENSE)).
