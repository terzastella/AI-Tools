import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { htmlToText, parsePublicUrl, resolveRedirects } from "../../core/net-guard.js";
import { scrubEnv } from "../../core/proc.js";
import type { ToolContext } from "../../core/context.js";

const execFileAsync = promisify(execFile);

export interface BrowserSnapshotInput {
  url: string;
  timeoutMs?: number;
  maxChars?: number;
}

export interface BrowserSnapshotOutput {
  url: string;
  browser: string;
  title: string;
  text: string;
  truncated: boolean;
}

export const BROWSER_SNAPSHOT_VERSION = "1.0.0";

const CANDIDATES = [
  process.env["CHROME_PATH"] ?? "",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

async function findBrowser(): Promise<string | null> {
  const { promises: fs } = await import("node:fs");
  for (const c of CANDIDATES) {
    try {
      await fs.access(c);
      return c;
    } catch {
      /* prossimo */
    }
  }
  return null;
}

export async function browserSnapshotLogic(ctx: ToolContext, input: BrowserSnapshotInput): Promise<BrowserSnapshotOutput> {
  const u = parsePublicUrl(input.url ?? "", ctx);
  const timeoutMs = input.timeoutMs ?? 30_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 5000 || timeoutMs > 90_000) {
    throw Object.assign(new Error("timeoutMs must be 5000..90000"), { code: "BAD_ARGS" });
  }
  const maxChars = input.maxChars ?? 20_000;
  if (!Number.isInteger(maxChars) || maxChars < 500 || maxChars > 100_000) {
    throw Object.assign(new Error("maxChars must be 500..100000"), { code: "BAD_ARGS" });
  }
  const browser = await findBrowser();
  if (!browser) {
    throw Object.assign(new Error("no Chrome/Edge found (set CHROME_PATH) — verifica UI non disponibile"), { code: "BROWSER_MISSING" });
  }

  ctx.logger.info("browser_snapshot", { url: u.hostname, browser });
  // Chrome segue i redirect da solo: pre-risolvi l'URL finale rivalidando ogni hop
  const final = await resolveRedirects(u, ctx, Math.min(timeoutMs, 15_000));
  let html: string;
  try {
    const { stdout } = await execFileAsync(
      browser,
      ["--headless", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=5000", "--dump-dom", final.toString()],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 8_000_000, env: scrubEnv(ctx) },
    );
    html = String(stdout);
  } catch (e: unknown) {
    const err = e as { killed?: boolean; message?: string };
    if (err.killed) throw Object.assign(new Error(`timeout after ${timeoutMs}ms`), { code: "TIMEOUT" });
    throw Object.assign(new Error(`browser failed: ${err.message ?? String(e)}`.slice(0, 300)), { code: "BROWSER_FAILED" });
  }
  const title = /<title[^>]*>([\s\S]{1,300}?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const text = htmlToText(html);
  return { url: input.url, browser, title, text: text.slice(0, maxChars), truncated: text.length > maxChars };
}
