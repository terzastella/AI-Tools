# AI-Tools — hands for AI agents

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node: 20+](https://img.shields.io/badge/node-20+-blue.svg)](packages/agent-tools/package.json)
[![CI](https://github.com/terzastella/AI-Tools/actions/workflows/ci.yml/badge.svg)](https://github.com/terzastella/AI-Tools/actions)

> 🇮🇹 Italiano? Leggi [README-IT.md](README-IT.md).

52 real TypeScript tools (`ToolDefinition` + `registry.register`) that give a model the capabilities it lacks on its own: files, terminal, git, web, memory, LSP, MCP, budget. MIT, by `terzastella`.

Plain-English guide in `docs/OVERVIEW.md`. Machine-readable catalog in `catalog/tools.json`.

## The 3 rules

- **Strict + always ask a human** — reads are free, writes and executions always ask (`src/core/approval.ts` + `guarded.ts`). Dangerous commands blocked even on accept.
- **Web directly and via MCP** — direct `web_fetch/web_search` + `mcp_call` for standard external servers.
- **Native, zero runtime dependencies** — Node 20+ only, tests with vitest.

## Quick start

```ts
import { toolkitDefinitions } from "ai-toolkit"; // or singles: writerDefinition, ...
for (const def of toolkitDefinitions) registry.register(def);
```

Secure by default:

```ts
import { wrapDefinition } from "ai-toolkit";
import { standardPolicy } from "ai-toolkit";
registry.register(wrapDefinition(writerDefinition, { policy: standardPolicy, audit }));
// ctx.approver = async () => "accept" | "deny"  <- your human button
```

Examples in `packages/agent-tools/examples/` (`register.ts`, `secure-register.ts`, `addon.json`, `mcp-servers.json`, `opencode.json`).

## Use inside opencode (or MCP agents)

No code: stdio MCP server in `servers/ai-tools-mcp/` exposing all 52 tools.

```sh
cd packages/agent-tools && pnpm build   # dist/ needed
```

Then copy `examples/opencode.json` into your `opencode.json` (change the two paths) — glob `ai-tools_*` already on `ask`.
5-task test plan in `docs/OPENCODE-TEST.md`. Server details in `servers/ai-tools-mcp/README.md`.

## The 52 tools

### Files (14)

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

### Find and understand code (9)

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

### Execute (5)

| Tool | Does |
|---|---|
| `bash_exec` | One command, no shell, with timeout |
| `shell_session` | Long processes: start/poll/kill/list |
| `test_runner` | vitest/pytest/npm → structured pass/fail |
| `lint_fix` | Gated `eslint --fix` |
| `sandbox_docker` | Command in isolated container (no network) |

### Git (2)

| Tool | Does |
|---|---|
| `git` | status/diff/log/branch/blame (read-only) |
| `git_write` | add/commit/branch/checkout/stash (never push: you do that in the App) |

### Reason and organize (13)

| Tool | Does |
|---|---|
| `todo` | Step list in `.agent/todos.json` |
| `ask_user` | Question to the human with options |
| `delegate_task` | Planning-only (does NOT call LLMs — see below) |
| `run_subagent` | Real sub-agent with isolated context (Ollama/echo) |
| `refactor_plan` | Executable plan, doesn't execute |
| `review_code` | Rule-based review + diagnose |
| `debug_error` | Stack trace to candidates + fix |
| `diagnose` | Aggregated tsc+eslint+vitest |
| `typecheck_file` | Filtered tsc |
| `generate_docs` | Docs from code |
| `create_skill` | New-tool scaffold |
| `schedule_cron` | Scheduled reminders (add/list/remove/due) |
| `budget_status` | Global token counter + cap |

### Text and RAG (3)

| Tool | Does |
|---|---|
| `count_tokens` | Token estimate chars/4 |
| `chunk_text` | Overlapped chunks |
| `pack_context` | Files → context with budget |

### Web and integrations (4)

| Tool | Does |
|---|---|
| `web_fetch` | Public page → text (anti-SSRF) |
| `web_search` | Keyless search (best-effort) |
| `browser_snapshot` | Headless Chrome/Edge rendered page |
| `mcp_call` | Calls MCP servers over stdio |

### Memory and hygiene (2)

| Tool | Does |
|---|---|
| `memory_store` | Local memory in `.agent/memory` (put/get/search) |
| `env_secrets` | Check without revealing + redact (read-only) |

> `delegate_task` is deterministic planning (calls no models). For a sub-agent that really reasons, use `run_subagent`.

Details for each in `packages/agent-tools/docs/tools/*.md`.

## Safety in short

- Fail-closed: deny always wins, nothing passes without an explicit allow (`src/core/policy.ts`).
- `write/execute` ask `accept | deny`; `deny` → `NEED_APPROVAL`, nothing touched.
- Append-only audit in `.agent/audit/*.jsonl` with `sessionId`.
- Global token budget with optional cap (`BUDGET_EXCEEDED`).
- Paths always inside cwd (anti-traversal), private URLs blocked, never secrets in logs.

## Privacy: what stays on your PC

- The public repo only gets code, docs and tests. Never your content.
- Everything tools write while working (`audit`, `history`, `todos`, `memory`, `schedule`, `budget`) lives in `.agent/`, ignored by git.
- Outputs include your disk paths (e.g. `read_file.abs`) and audits store the `cwd`: they stay local, never commit `.agent/`.

## Validation

```sh
cd packages/agent-tools
pnpm install
pnpm typecheck
pnpm test
```

CI on every push (`.github/workflows/ci.yml`): install + typecheck + test.

## Status

v0.16.0 — 52 tools, 8 phases (base → lock → exec+natives → MCP → dev loop → knowledge → senses → brain). History in `git log`.
