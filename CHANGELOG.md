# Changelog

Formato Keep-a-Changelog. Pre-1.0: breaking possibili solo fuori dal core-15
(vedi `docs/LEVELS.md`).

## [Unreleased]

## [0.18.0] - 2026-10-07

### Added
- Audit con redact secret + hash-chain sha256 + tool `audit_verify`
- Livelli core-15 garantiti vs 38 estesi (`toolkitCore`, `docs/LEVELS.md`)
- `tests/adversarial.test.ts`: scenario ostile end-to-end (traversal, symlink,
  `rm -rf /` con accept, `curl|sh`, metadata cloud, exfil secret, budget)
- `tests/docs-coverage.test.ts`: ogni tool deve avere la sua pagina docs
- MCP server stdio (`servers/ai-tools-mcp/`) + `examples/opencode.json` + piano 5 task

### Fixed
- `todo` avvolto rispondeva sempre `POLICY_DENIED` (dominio dedicato come memory/schedule)
- Guard controllava solo il binario: ora riga comando intera (`fullCommand`)
- `web_search` seguiva redirect ciechi sul POST (ora rivalidati)

### Changed
- Env processi figli scrubbed (`core/proc.ts`, allowlist + `ctx.envAllow`)
- `resolveSafePath` risolve symlink (realpath)
- Redirect rivalidati hop-per-hop in `web_fetch`, `web_search`, `browser_snapshot`
- README bilingue EN primario + `README-IT.md`, LICENSE MIT, CI verde

## [0.10.0] - 2026-10-05

Base iniziale portata nel repo: 31 tool + approval gate accept/deny, policy
fail-closed, audit file, `bash_exec` e port nativi, MCP client, loop dev
(sessioni, git locale, test, lint), conoscenza (web, AST, memoria, secrets),
sensi (immagini, browser, cron, sandbox), cervello (LSP, budget, sub-agent).
Dettaglio fasi in `git log` 2026-10-05/07.
