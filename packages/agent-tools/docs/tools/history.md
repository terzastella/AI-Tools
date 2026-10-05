# history — `history` v1.0

Cronologia manuale come Google Docs. Solo manuale, niente snapshot automatici.

- `record {path}` → foto in `.agent/history/<hash>/<timestamp>`, tiene ultime N (default 20).
- `list {path?}` → versioni con `versionId, time, bytes, hash`.
- `restore {path, versionId}` → ricopia indietro con tmp+rename.
- `clear {path?}` → svuota solo il magazzino, mai il file originale.
