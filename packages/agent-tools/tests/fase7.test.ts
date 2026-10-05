import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext } from "../src/core/context.js";
import { MemoryAudit } from "../src/core/audit.js";
import { wrapDefinition } from "../src/core/guarded.js";
import { standardPolicy } from "../src/core/policy.js";
import { acceptAllApprover, denyAllApprover } from "../src/core/approval.js";
import { imageReadDefinition } from "../src/tools/image-read/definition.js";
import { browserSnapshotDefinition } from "../src/tools/browser-snapshot/definition.js";
import { scheduleCronDefinition } from "../src/tools/schedule-cron/definition.js";
import { sandboxDockerDefinition } from "../src/tools/sandbox-docker/definition.js";
import { todoDefinition } from "../src/tools/todo/definition.js";
import { secureDefinitions } from "../examples/secure-register.js";

// PNG 1x1 rosso
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const MINI_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]/Contents 4 0 R>>endobj
4 0 obj<</Length 60>>stream
BT /F1 12 Tf 10 90 Td (Ciao dal PDF di prova) Tj ET
endstream
endobj
trailer<</Root 1 0 R>>`;

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-fase7-"));
  await fs.mkdir(path.join(tmp, "img"), { recursive: true });
  await fs.writeFile(path.join(tmp, "img", "p.png"), Buffer.from(PNG_B64, "base64"));
  await fs.writeFile(path.join(tmp, "img", "doc.pdf"), MINI_PDF, "utf8");
  await fs.writeFile(path.join(tmp, "img", "note.txt"), "no", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

function ctx() {
  const c = createContext(tmp);
  c.approver = acceptAllApprover;
  return c;
}

describe("fase7 sensi e autonomia", () => {
  it("secure-register espone 49 tool", () => {
    expect(secureDefinitions(tmp).length).toBe(49);
  });

  it("image_read png torna base64", async () => {
    const g = wrapDefinition(imageReadDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { path: "img/p.png" }, ctx: ctx() });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.mime).toBe("image/png");
      expect(res.data.base64).toBe(PNG_B64);
    }
  });

  it("image_read pdf estrae testo best-effort e rifiuta txt", async () => {
    const g = wrapDefinition(imageReadDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const pdf = await g.execute({ args: { path: "img/doc.pdf" }, ctx: ctx() });
    expect(pdf.ok).toBe(true);
    if (pdf.ok) expect(pdf.data.text).toContain("Ciao dal PDF di prova");
    const txt = await g.execute({ args: { path: "img/note.txt" }, ctx: ctx() });
    expect(txt.ok).toBe(false);
    expect(txt.error?.code).toBe("BAD_TYPE");
  });

  it("browser_snapshot valida url e host privati", async () => {
    const g = wrapDefinition(browserSnapshotDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const bad = await g.execute({ args: { url: "ftp://x" }, ctx: ctx() });
    expect(bad.ok).toBe(false);
    expect(bad.error?.code).toBe("BAD_ARGS");
    const priv = await g.execute({ args: { url: "http://127.0.0.1:9/x" }, ctx: createContext(tmp) });
    expect(priv.ok).toBe(false);
    expect(priv.error?.code).toBe("PRIVATE_HOST");
  });

  it("browser_snapshot con deny non lancia", async () => {
    const c = createContext(tmp);
    c.approver = denyAllApprover;
    const g = wrapDefinition(browserSnapshotDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { url: "https://example.com" }, ctx: c });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("NEED_APPROVAL");
  });

  it("schedule add -> due -> remove", async () => {
    const c = ctx();
    const g = wrapDefinition(scheduleCronDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const add = await g.execute({ args: { op: "add", task: "controlla backup", cron: "* * * * *" }, ctx: c });
    expect(add.ok).toBe(true);
    const due = await g.execute({ args: { op: "due", now: new Date().toISOString() }, ctx: c });
    expect(due.ok).toBe(true);
    if (due.ok) expect(due.data.items!.length).toBe(1);
    const bad = await g.execute({ args: { op: "add", task: "x", cron: "mai" }, ctx: c });
    expect(bad.ok).toBe(false);
    if (add.ok) {
      const rm = await g.execute({ args: { op: "remove", id: add.data.item!.id }, ctx: c });
      expect(rm.ok).toBe(true);
    }
  });

  it("sandbox_docker valida e blocca pericolosi", async () => {
    const g = wrapDefinition(sandboxDockerDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const badImg = await g.execute({ args: { image: "../evil", cmd: ["echo"] }, ctx: ctx() });
    expect(badImg.ok).toBe(false);
    expect(badImg.error?.code).toBe("BAD_ARGS");
    const danger = await g.execute({ args: { image: "alpine", cmd: ["rm", "-rf", "/"] }, ctx: ctx() });
    expect(danger.ok).toBe(false);
  });

  it("todo ora funziona anche avvolto (fix dominio)", async () => {
    const c = ctx();
    const g = wrapDefinition(todoDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const add = await g.execute({ args: { action: "add", text: "prova fix" }, ctx: c });
    expect(add.ok).toBe(true);
    const list = await g.execute({ args: { action: "list" }, ctx: c });
    expect(list.ok).toBe(true);
  });
});
