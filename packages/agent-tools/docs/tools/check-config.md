# check_config — `check_config` v1.0

Controlla `package.json` e `tsconfig.json` con regole pure. Solo lettura.

- Regole: json valido, `name`, `scripts`, `engines.node`, `strict:true`, `outDir != rootDir`.
- Output: `{ issues: [{path, rule, message, severity}], summary, checked }`.
