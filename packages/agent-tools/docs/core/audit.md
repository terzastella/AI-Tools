# audit — quaderno su file

Default attivo su file: `.agent/audit/ai-toolkit-YYYY-MM-DD.jsonl` (un file al giorno, append JSONL).

Riga: `{time, tool, ok, durationMs, decision: allow|deny, reason?, cwd}`. Scritto sia su allow che su deny. Mai throw: se fallisce → `logger.warn`.

Per test: `MemoryAudit` (solo memoria). Per prod: `FileAudit(cwd)`.
