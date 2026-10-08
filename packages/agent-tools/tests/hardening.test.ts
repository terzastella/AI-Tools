import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { createContext, resolveSafePath } from "../src/core/context.js";
import { scrubEnv } from "../src/core/proc.js";
import { isPrivateIp, parsePublicUrl, resolveRedirects } from "../src/core/net-guard.js";
import { MemoryAudit } from "../src/core/audit.js";
import { wrapDefinition } from "../src/core/guarded.js";
import { standardPolicy } from "../src/core/policy.js";
import { acceptAllApprover } from "../src/core/approval.js";
import { bashExecDefinition } from "../src/tools/bash-exec/definition.js";
import { webFetchDefinition } from "../src/tools/web-fetch/definition.js";

let tmp: string;
let servers: Server[] = [];

async function serve(
  handler: (reqUrl: string, res: { redirect: (loc: string) => void; html: (b: string) => void }) => void,
): Promise<number> {
  const s = createServer((req, res) => {
    handler(req.url ?? "/", {
      redirect: (loc: string) => {
        res.writeHead(302, { location: loc });
        res.end();
      },
      html: (b: string) => {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(b);
      },
    });
  });
  servers.push(s);
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const addr = s.address();
  if (typeof addr !== "object" || !addr) throw new Error("no port");
  return addr.port;
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ait-hard-"));
  await fs.mkdir(path.join(tmp, "work"), { recursive: true });
  await fs.mkdir(path.join(tmp, "probe"), { recursive: true });
  await fs.writeFile(path.join(tmp, "probe", "outside.txt"), "segreto\n", "utf8");
  await fs.writeFile(path.join(tmp, "work", "inside.txt"), "ok\n", "utf8");
  // junction su win (no admin), dir symlink altrove
  try {
    await fs.symlink(
      path.join(tmp, "probe"),
      path.join(tmp, "work", "link"),
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch {
    /* FS senza symlink: il test salta */
  }
});

afterEach(async () => {
  for (const s of servers) await new Promise<void>((r) => s.close(() => r()));
  servers = [];
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("hardening 1-2-3", () => {
  it("symlink che esce dal cwd viene rifiutato", async () => {
    const ctx = createContext(path.join(tmp, "work"));
    try {
      await fs.stat(path.join(tmp, "work", "link"));
    } catch {
      return; // niente symlink su questo FS: skip
    }
    expect(resolveSafePath(ctx, "link/outside.txt").ok).toBe(false);
    expect(resolveSafePath(ctx, "inside.txt").ok).toBe(true);
  });

  it("scrubEnv toglie i secret e tiene PATH", () => {
    process.env["AIT_HARD_SECRET"] = "shh-non-diffondere";
    const ctx = createContext(tmp);
    const env = scrubEnv(ctx);
    expect(env["AIT_HARD_SECRET"]).toBeUndefined();
    expect(typeof env["PATH"]).toBe("string");
    expect(scrubEnv(ctx, { MIA_CHIAVE: "abc" })["MIA_CHIAVE"]).toBe("abc");
    delete process.env["AIT_HARD_SECRET"];
  });

  it("ctx.envAllow allarga solo su richiesta", () => {
    process.env["AIT_EXTRA_OK"] = "1";
    const ctx = createContext(tmp);
    expect(scrubEnv(ctx)["AIT_EXTRA_OK"]).toBeUndefined();
    ctx.envAllow = ["AIT_EXTRA_OK"];
    expect(scrubEnv(ctx)["AIT_EXTRA_OK"]).toBe("1");
    delete process.env["AIT_EXTRA_OK"];
  });

  it("isPrivateIp copre loopback, RFC1918 e metadata", () => {
    for (const h of [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.9.9",
      "192.168.1.1",
      "169.254.169.254",
      "::1",
      "x.localhost",
    ]) {
      expect(isPrivateIp(h)).toBe(true);
    }
    for (const h of ["example.com", "8.8.8.8", "1.2.3.4", "172.15.0.1", "172.32.0.1"]) {
      expect(isPrivateIp(h)).toBe(false);
    }
  });

  it("bash_exec non vede i secret del padre", async () => {
    process.env["AIT_HARD_SECRET"] = "shh-non-diffondere";
    const ctx = createContext(tmp);
    ctx.approver = acceptAllApprover;
    const g = wrapDefinition(bashExecDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({
      args: { cmd: "node", args: ["-e", "console.log(process.env.AIT_HARD_SECRET || 'clean')"] },
      ctx,
    });
    delete process.env["AIT_HARD_SECRET"];
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.stdout).toContain("clean");
      expect(res.data.stdout).not.toContain("shh-non-diffondere");
    }
  });

  it("resolveRedirects segue la catena e rivalida ogni hop", async () => {
    const portB = await serve((_u, res) => res.html("<html><body><p>finale</p></body></html>"));
    const portA = await serve((_u, res) => res.redirect(`http://127.0.0.1:${portB}/page`));
    const ctx = createContext(tmp);
    ctx.allowPrivateNet = true;
    const fin = await resolveRedirects(parsePublicUrl(`http://127.0.0.1:${portA}/go`, ctx), ctx, 5000);
    expect(fin.port).toBe(String(portB));
  });

  it("redirect loop -> TOO_MANY_REDIRECTS", async () => {
    let port = 0;
    port = await serve((_u, res) => res.redirect(`http://127.0.0.1:${port}/loop`));
    const ctx = createContext(tmp);
    ctx.allowPrivateNet = true;
    await expect(
      resolveRedirects(parsePublicUrl(`http://127.0.0.1:${port}/loop`, ctx), ctx, 5000),
    ).rejects.toMatchObject({ code: "TOO_MANY_REDIRECTS" });
  });

  it("web_fetch segue redirect validi fino al contenuto", async () => {
    const portB = await serve((_u, res) => res.html("<html><body><h1>Arrivato via redirect</h1></body></html>"));
    const portA = await serve((_u, res) => res.redirect(`http://127.0.0.1:${portB}/page`));
    const ctx = createContext(tmp);
    ctx.allowPrivateNet = true;
    const g = wrapDefinition(webFetchDefinition, { policy: standardPolicy, audit: new MemoryAudit() });
    const res = await g.execute({ args: { url: `http://127.0.0.1:${portA}/go` }, ctx });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.text).toContain("Arrivato via redirect");
  });
});
