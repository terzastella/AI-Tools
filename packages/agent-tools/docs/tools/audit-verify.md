# audit_verify

Verifica la catena hash dell'audit giornaliero (`sha256` per riga): dice se è integro o quale riga è manomessa. Solo lettura, default il file di oggi (`YYYY-MM-DD` opzionale). Vedi `verifyAuditFile` in `src/core/audit.ts`.
