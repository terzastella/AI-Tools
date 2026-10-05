# writer — `create_file` v1.0

Crea file da zero con scrittura atomica (tmp + rename).

- Sicurezze: blocca traversal fuori `cwd`, rifiuta overwrite senza flag, rifiuta directory target.
- Flags: `overwrite=false`, `mkdirs=true`, `dryRun=false`.
- Output: `{ path, abs, bytes, created, overwritten, dryRun, hash }` + `meta { tool, version, durationMs }`.
- Errori tipizzati (mai throw raw da `execute()`): `BAD_ARGS | PATH_TRAVERSAL | EXISTS | IS_DIRECTORY | INTERNAL`.

Esempio agent:

```ts
import { writerDefinition } from "ai-toolkit";
import { createContext } from "ai-toolkit/dist/core/index.js";

const ctx = createContext(process.cwd());
const res = await writerDefinition.execute({
  args: { path: "src/hello.ts", content: "export const x = 1;\n" },
  ctx,
});
```
