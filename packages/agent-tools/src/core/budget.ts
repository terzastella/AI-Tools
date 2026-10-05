/**
 * Budget token globale: ogni tool avvolto stima i token di args+result
 * e li accumula in .agent/budget.jsonl. Best-effort, mai blocca per errori IO.
 * Stima euristica chars/4 come count_tokens (non un tokenizer reale).
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateArgsTokens(args: unknown): number {
  try {
    return estimateTokens(JSON.stringify(args ?? ""));
  } catch {
    return 0;
  }
}

async function budgetFile(cwd: string): Promise<string> {
  const dir = path.resolve(cwd, ".agent");
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, "budget.jsonl");
}

export async function recordUsage(cwd: string, tokens: number): Promise<void> {
  try {
    if (!Number.isFinite(tokens) || tokens <= 0) return;
    const file = await budgetFile(cwd);
    await fs.appendFile(file, JSON.stringify({ time: new Date().toISOString(), tokens }) + "\n", "utf8");
  } catch {
    /* best-effort */
  }
}

export interface BudgetStatus {
  used: number;
  calls: number;
}

export async function readUsage(cwd: string): Promise<BudgetStatus> {
  try {
    const file = await budgetFile(cwd);
    const raw = await fs.readFile(file, "utf8");
    let used = 0;
    let calls = 0;
    for (const line of raw.split("\n")) {
      const s = line.trim();
      if (!s) continue;
      try {
        const e = JSON.parse(s) as { tokens?: number };
        if (typeof e.tokens === "number" && e.tokens > 0) {
          used += e.tokens;
          calls++;
        }
      } catch {
        /* salta */
      }
    }
    return { used, calls };
  } catch {
    return { used: 0, calls: 0 };
  }
}

export async function resetUsage(cwd: string): Promise<BudgetStatus> {
  const before = await readUsage(cwd);
  try {
    const file = await budgetFile(cwd);
    await fs.writeFile(file, "", "utf8");
  } catch {
    /* best-effort */
  }
  return before;
}
