import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { MemoryAudit } from "../src/core/audit.js";
import { wrapDefinition } from "../src/core/guarded.js";
import { standardPolicy } from "../src/core/policy.js";
import { acceptAllApprover } from "../src/core/approval.js";
import { webFetchDefinition } from "../src/tools/web-fetch/definition.js";
import { webSearchDefinition } from "../src/tools/web-search/definition.js";
import { astSearchDefinition } from "../src/tools/ast-search/definition.js";
import { memoryStoreDefinition } from "../src/tools/memory-store/definition.js";
import { envSecretsDefinition } from "../src/tools/env-secrets/definition.js";
import { secureDefinitions } from "../examples/secure-register.js";

let tmp: string;
let server: Server;
let base: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-fase6-"));
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.writeFile(path.join(tmp, "src", "calc.ts"), "export function somma(a: number, b: number): number {\n  return a + b;\n}\n\nexport class Calcolatrice {\n  azzera(): number {\n    return 0;\n  }\n}\n", "utf8");
  server = createServer((req, res) => {
    if (req.url?.startsWith("/search")) {
      res.writeHead(200, { "content-type": "text/html" }).end(
        `<html><body><a href="https://example.com/docs-guida-completa">Guida completa molto lunga qui</a><a href="https://example.com/altro">Altro risultato abbastanza lungo qui</a></body></html>`,
      );
    } else {
      res.writeHead(200, { "content-type": "text/html" }).end(
        `<html><head><title>T</title><script>var x=1;</script></head><body><h1>Manuale quadrillionario</h1><p>Contenuto vero della pagina.</p></body></html>`,
      );
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await fs.rm(tmp, { recursive: true, force: true });
});

function localCtx() {
  const ctx = createContext(tmp);
  ctx.approver = acceptAllApprover;
  ctx.allowPrivateNet = true;
  return ctx;
}

describe("fase6 conoscenza", () => {
  it("secure-register espone 52 tool", () => {
    expect(secureDefinitions(tmp).length).toBe(52);
  });

  it("web_fetch legge pagina locale e toglie script", async () => {
    const g = wrapDefinition(webFetchDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { url: `${base}/manuale` }, ctx: localCtx() });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.text).toContain("Manuale quadrillionario");
      expect(res.data.text).not.toContain("var x=1");
    }
  });

  it("web_fetch blocca host privati senza flag", async () => {
    const ctx = createContext(tmp);
    const g = wrapDefinition(webFetchDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { url: `${base}/manuale` }, ctx });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("PRIVATE_HOST");
  });

  it("web_search con endpoint locale", async () => {
    const g = wrapDefinition(webSearchDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { query: "manuale", topK: 5, endpoint: `${base}/search` }, ctx: localCtx() });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.hits.length).toBe(2);
      expect(res.data.hits[0]!.url).toBe("https://example.com/docs-guida-completa");
    }
  });

  it("ast_search trova function e class", async () => {
    const g = wrapDefinition(astSearchDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { paths: ["src"], maxResults: 20 }, ctx: localCtx() });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const kinds = res.data.matches.map((m) => `${m.kind}:${m.name}`);
      expect(kinds).toContain("function:somma");
      expect(kinds).toContain("class:Calcolatrice");
    }
  });

  it("ast_search filtra per simbolo", async () => {
    const g = wrapDefinition(astSearchDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { symbol: "calc", kind: "class", paths: ["src"] }, ctx: localCtx() });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.matches.every((m) => m.kind === "class")).toBe(true);
  });

  it("memory put -> search -> get", async () => {
    const ctx = localCtx();
    ctx.approver = acceptAllApprover;
    const g = wrapDefinition(memoryStoreDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const put = await g.execute({ args: { op: "put", text: "il cliente vuole fattura elettronica", scope: "session" }, ctx });
    expect(put.ok).toBe(true);
    const search = await g.execute({ args: { op: "search", query: "fattura elettronica", scope: "session" }, ctx });
    expect(search.ok).toBe(true);
    if (search.ok) expect(search.data.entries!.length).toBe(1);
    if (put.ok) {
      const get = await g.execute({ args: { op: "get", id: put.data.entry!.id, scope: "session" }, ctx });
      expect(get.ok).toBe(true);
    }
  });

  it("env_secrets check non rivela valori, redact maschera", async () => {
    process.env.AIT_FASE6_TEST = "super-segreto-12345";
    const g = wrapDefinition(envSecretsDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const check = await g.execute({ args: { op: "check", keys: ["AIT_FASE6_TEST", "AIT_NON_ESISTE_XYZ"] }, ctx: localCtx() });
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.data.checked).toEqual([
        { key: "AIT_FASE6_TEST", set: true, length: 19 },
        { key: "AIT_NON_ESISTE_XYZ", set: false, length: 0 },
      ]);
    }
    const redact = await g.execute({ args: { op: "redact", keys: ["AIT_FASE6_TEST"], text: "token=super-segreto-12345 fine" }, ctx: localCtx() });
    expect(redact.ok).toBe(true);
    if (redact.ok) {
      expect(redact.data.redacted).toBe("token=*** fine");
      expect(redact.data.redacted).not.toContain("super-segreto");
    }
    delete process.env.AIT_FASE6_TEST;
  });
});
