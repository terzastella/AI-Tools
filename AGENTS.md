# AGENTS.md — AI-Tools

Lavoriamo SOLO dentro `D:\Projects\AI-Toolkit\AI-Tools`.
NON toccare `../ai-skills` mai.

Struttura:
- `packages/agent-tools/src/core/` — tipi, policy, approval, audit, guarded
- `packages/agent-tools/src/tools/*/` — 31 tool esistenti
- `packages/py-ref/` — riferimento Python, non eseguire come tool
- `catalog/tools.json` — lista tool, generata
- `docs/` — spiegazioni semplici

Regole:
- Policy fail-closed: deny vince sempre.
- Write/execute chiedono sempre approver accept/deny se presente.
- Mai throw raw dai tool: sempre ok/fail con durationMs.
- Test: ogni nuovo core deve avere test in `packages/agent-tools/tests/`.
