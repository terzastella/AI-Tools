/**
 * Audit append-only su file giornaliero + sink memory per test.
 * Mai throw: best-effort.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Logger } from "./context.js";

export interface AuditEntry {
  time: string;
  tool: string;
  ok: boolean;
  durationMs: number;
  decision: "allow" | "deny" | "need_approval";
  reason?: string;
  cwd: string;
}

export interface AuditSink {
  write(entry: AuditEntry): Promise<void>;
}

export class MemoryAudit implements AuditSink {
  entries: AuditEntry[] = [];
  async write(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

function dayStamp(d = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export class FileAudit implements AuditSink {
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
      await fs.appendFile(file, JSON.stringify(entry) + "\n", "utf8");
    } catch (e) {
      this.logger?.warn("audit write failed", { error: e instanceof Error ? e.message : String(e) });
    }
  }
}
