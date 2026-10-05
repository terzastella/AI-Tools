# policy — buttafuori (bloccare)

Fail-closed: se nessuna regola allow matcha → deny. Deny vince sempre.

Preset:
- `standard` (default): read ovunque in cwd + write solo `src/**, docs/**, tests/**, examples/**, .tmp-*/**, .agent/addons/**`. Nega `.env*, .git/**, node_modules/**, dist/**` e tutto il resto write.
- `readonly`: solo read.
- `strict`: solo read (come readonly, per dry-run globale usa `ctx.dryRunGlobal`).

Uso: `wrapDefinition(def, {policy: standardPolicy})`. Errore: `POLICY_DENIED` con `details {permission, target}`.
