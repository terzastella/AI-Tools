/**
 * Audit append-only su file giornaliero + sink memory per test.
 * Mai throw: best-effort.
 * - redact: i reason vengono ripuliti da secret-like prima di scrivere.
 * - hash-chain: ogni riga del file include sha256(prev + riga),
 *   verificabile con verifyAuditFile (manomissione = rilevata).
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { redactSecrets } from "./redact.js";
import type { Logger } from "./context.js";

export interface AuditEntry {
  time: string;
  tool: string;
  ok: boolean;
  durationMs: number;
  decision: "allow" | "deny" | "need_approval";
  reason?: string;
  cwd: string;
  sessionId?: string | undefined;
}

export interface AuditSink {
  write(entry: AuditEntry): Promise<void>;
}

function cleanEntry(entry: AuditEntry): AuditEntry {
  if (entry.reason === undefined) return { ...entry };
  return { ...entry, reason: redactSecrets(entry.reason) };
}

function chainHash(prev: string, entryJson: string): string {
  return createHash("sha256").update(`${prev}\n${entryJson}`).digest("hex");
}

async function readLastHash(file: string): Promise<string> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return "GENESIS";
    const last = JSON.parse(lines[lines.length - 1]!) as { hash?: string };
    return typeof last.hash === "string" ? last.hash : "GENESIS";
  } catch {
    return "GENESIS";
  }
}

export interface AuditVerifyResult {
  ok: boolean;
  checked: number;
  badLine?: number;
}

export async function verifyAuditFile(file: string): Promise<AuditVerifyResult> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return { ok: false, checked: 0, badLine: 0 };
  }
  let prev = "GENESIS";
  let checked = 0;
  for (const [i, line] of raw.split("\n").entries()) {
    const s = line.trim();
    if (!s) continue;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(s) as Record<string, unknown>;
    } catch {
      return { ok: false, checked, badLine: i + 1 };
    }
    const { hash, ...rest } = parsed;
    if (typeof hash !== "string") return { ok: false, checked, badLine: i + 1 };
    if (chainHash(prev, JSON.stringify(rest)) !== hash) return { ok: false, checked, badLine: i + 1 };
    prev = hash;
    checked++;
  }
  return { ok: true, checked };
}

export class MemoryAudit implements AuditSink {
  entries: AuditEntry[] = [];
  async write(entry: AuditEntry): Promise<void> {
    this.entries.push(cleanEntry(entry));
  }
}

function dayStamp(d = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export class FileAudit implements AuditSink {
  private chains = new Map<string, string>();
  constructor(
    private cwd: string,
    private logger?: Logger,
    private dirName = ".agent/audit",
  ) {}

  async write(entry: AuditEntry): Promise<void> {
    try {
      const dir = path.resolve(this.cwd, this.dirName);
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `ai-toolkit-${dayStamp()}.jsonl`);
      if (!this.chains.has(file)) this.chains.set(file, await readLastHash(file));
      const clean = cleanEntry(entry);
      const prev = this.chains.get(file) ?? "GENESIS";
      const hash = chainHash(prev, JSON.stringify(clean));
      await fs.appendFile(file, JSON.stringify({ ...clean, hash }) + "\n", "utf8");
      this.chains.set(file, hash);
    } catch (e) {
      this.logger?.warn("audit write failed", { error: e instanceof Error ? e.message : String(e) });
    }
  }
}
