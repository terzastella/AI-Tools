# Security review log — risposta alla review esterna (Copilot, 7.5/10)

Review ricevuta il 2026-10-07: 7.5/10 con 8 aree di critica. Qui punto per punto:
cosa era già coperto, cosa abbiamo fixato davvero, cosa resta onestamente aperto.

## 1. "52 tool troppi, stabilizza 10–15 core"

**Accolto in forma diversa.** Non tagliamo funzioni: marchiamo livelli.
`src/toolkit.ts` espone `toolkitCore` (15 nomi inchiodati da `tests/levels.test.ts`),
resto estesi best-effort. Dettagli in `docs/LEVELS.md`, badge nei README, campo `levels` in `catalog/tools.json`.

## 2. Hardening terminale

| Punto | Stato |
|---|---|
| cwd-only filesystem | ✅ da sempre (`resolveSafePath`) |
| symlinks blocked | ✅ fixato: `realpath` in `resolveSafePath` (`src/core/context.ts`), test con link-trappola (`tests/hardening.test.ts`) |
| env isolation | ✅ fixato: `scrubEnv` allowlist in `src/core/proc.ts`, cablata negli 11 spawn; extra solo via `ctx.envAllow` o env esplicite MCP |
| no network by default | ⚠️ parziale: `sandbox_docker` gira `--network none`, ma `bash_exec` non filtra la rete (documentato; per isolamento vero usare sandbox) |
| sandbox/container per tutto | ⚠️ onesto: container solo via `sandbox_docker` (richiede daemon), resto in sandbox path+policy+approval |

## 3. SSRF / fetch / browser

| Punto | Stato |
|---|---|
| privati, localhost, metadata, internal ranges | ✅ da Fase 6 (`src/core/net-guard.ts`: loopback, RFC1918, 169.254, `.localhost/.internal/.local`) |
| redirect rivalidati | ✅ fixato: `resolveRedirects` rivalida ogni hop (max 3), usato da `web_fetch`, `web_search`, `browser_snapshot` (pre-resolve) |
| file download limits | ✅ budget `maxChars` + `maxBytes`/`maxBuffer` ovunque |
| browser limitato | ✅ headless `--dump-dom` solo lettura pagina + pre-resolve URL; `BROWSER_MISSING` se manca Chrome/Edge |

## 4. Secrets

| Punto | Stato |
|---|---|
| policy `.env`/tokens | ✅ da sempre: deny `.env*` in scrittura, `env_secrets` non ritorna mai valori |
| redaction in logs/audit | ✅ fixato: `src/core/redact.ts` applicato in `audit.write` (test: `api_key='***'`) |
| mai loggare input sensibili | ✅ gli audit non loggano mai gli args, solo metadata + reason redatti |

## 5. Audit "quasi tamper-proof"

Mai promesso tamper-proof. Ora: hash-chain `sha256` per riga + `verifyAuditFile` + tool `audit_verify`
(rileva la riga manomessa, testato). Resta locale e senza firma esterna: dichiarato, non promesso.
Out-of-band sink: non fatto (futuro, vedi sotto).

## 6. Test end-to-end

✅ `tests/adversarial.test.ts`: scenario ostile unico (traversal, symlink, `rm -rf /` con accept,
`curl|sh`, metadata cloud, exfil secret, budget) — tutto negato e loggato. Durante la scrittura
ha trovato un bug vero (guard che controllava solo il binario), fixato con `fullCommand()` + regression test.
Suite intera: 44 file, 212+ test verdi, CI su ogni push.

## 7. Gap vision/reality

✅ `docs/LEVELS.md` (core garantiti vs estesi best-effort), ogni limite marcato nel codice
(`best-effort`, `TYPESCRIPT_MISSING`, `DOCKER_MISSING`, `OLLAMA_MISSING`, `BROWSER_MISSING`),
`delegate_task` dichiarato planning-only. Niente "safe for production" scritto da nessuna parte.

## 8. API stability

⚠️ parziale: versioni semver (`0.18.0`), `toolkitCore` inchiodato da test (breaking consciente),
ma pre-1.0 = breaking possibili. Dichiarato qui e in `docs/LEVELS.md`.

## Resta aperto (onesto)

- Mirror audit out-of-band (seconda copia verificabile fuori cwd).
- Memoria vettoriale (oggi solo keyword) e stima token euristica (oggi chars/4).
- `web_search` best-effort su layout DDG (documentato nel tool).
- Nessun caso d'uso reale end-to-end dentro un agente oltre i 5 task di `docs/OPENCODE-TEST.md`.
