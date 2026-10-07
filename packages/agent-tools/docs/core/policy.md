# policy — buttafuori (bloccare)

Fail-closed: se nessuna regola allow matcha → deny. Deny vince sempre.

Preset:
- `standard` (default): read ovunque in cwd + write solo `src/**, docs/**, tests/**, examples/**, .tmp-*/**, .agent/addons/**`. Nega `.env*, .git/**, node_modules/**, dist/**` e tutto il resto write. Permette `terminal:execute` (serve comunque accept umano), `memory`, `schedule`, `todo`, `budget`.
- `readonly`: solo read.
- `strict`: solo read (come readonly, per dry-run globale usa `ctx.dryRunGlobal`).

Path: `resolveSafePath` risolve i symlink (realpath) — un link dentro cwd che punta fuori viene rifiutato. Resta una race TOCTOU microscopica tra check e uso, come in ogni sandbox path-based.

Processi figli: env scrubbed — passa solo allowlist minima (`PATH, HOME, TEMP...`, vedi `core/proc.ts`) + `ctx.envAllow` o env esplicite per-server MCP. Mai tutto `process.env`.

Uso: `wrapDefinition(def, {policy: standardPolicy})`. Errore: `POLICY_DENIED` con `details {permission, target}`.
