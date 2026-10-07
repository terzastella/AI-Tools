# AGENTS.md — AI-Tools

Lavoriamo SOLO dentro la root di questa repo (path relativi, mai assoluti).

Struttura:
- `packages/agent-tools/src/core/` — tipi, policy, approval, audit, guarded, budget, model-router
- `packages/agent-tools/src/tools/*/` — 52 tool
- `packages/py-ref/` — riferimento Python, non eseguire come tool
- `servers/ai-tools-mcp/` — server MCP stdio
- `catalog/tools.json` — lista tool, generata
- `docs/` — spiegazioni semplici

Regole:
- Policy fail-closed: deny vince sempre.
- Write/execute chiedono sempre approver accept/deny se presente.
- Mai throw raw dai tool: sempre ok/fail con durationMs.
- Test: ogni nuovo core deve avere test in `packages/agent-tools/tests/`.
