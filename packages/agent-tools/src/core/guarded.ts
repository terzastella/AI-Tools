/**
 * Wrapper difensivo: policy enforce + audit file.
 * Non tocca le logic dei 9 tool — intercetta solo execute().
 */
import { fail, type AgentToolResult } from "./result.js";
import type { ToolDefinition } from "./types.js";
import { checkPolicy, extractTargets, isDangerousCommand, standardPolicy, type Policy } from "./policy.js";
import { needsApproval } from "./approval.js";
import { estimateArgsTokens, estimateTokens, readUsage, recordUsage } from "./budget.js";
import type { AuditSink } from "./audit.js";
import { FileAudit } from "./audit.js";

export interface GuardOptions {
  policy?: Policy;
  audit?: AuditSink;
}

export function wrapDefinition<TArgs extends Record<string, unknown>, TOut>(
  def: ToolDefinition<TArgs, TOut>,
  opts: GuardOptions = {},
): ToolDefinition<TArgs, TOut> {
  const policy = opts.policy ?? standardPolicy;
  return {
    ...def,
    permissions: def.permissions,
    async execute({ args, ctx, signal }): Promise<AgentToolResult<TOut>> {
      const start = performance.now();
      const audit: AuditSink = opts.audit ?? new FileAudit(ctx.cwd, ctx.logger);
      const targets = extractTargets((args as Record<string, unknown>) ?? {});

      // dryRun globale: forza dryRun dove supportato
      let effectiveArgs = args;
      if (ctx.dryRunGlobal === true && typeof (args as Record<string, unknown>)["dryRun"] !== "boolean") {
        effectiveArgs = { ...(args as unknown as Record<string, unknown>), dryRun: true } as unknown as TArgs;
      }

      // Check ogni permission. Per write, verifica target (se nessun target, fail-closed tranne read).
      for (const perm of def.permissions) {
        if (perm.action === "read") {
          const c = checkPolicy(policy, perm);
          if (!c.allow) {
            const res = fail(def.name, def.metadata?.version ?? "1.0.0", "POLICY_DENIED", c.reason, Math.round(performance.now() - start), {
              permission: `${perm.domain}:${perm.action}`,
            });
            await audit.write({ time: new Date().toISOString(), tool: def.name, ok: false, durationMs: res.meta.durationMs, decision: "deny", reason: c.reason, cwd: ctx.cwd, sessionId: ctx.sessionId });
            return res;
          }
          continue;
        }
        // write/execute: se ci sono target, almeno uno deve essere allow e nessuno deny
        if (targets.length === 0) {
          // read-only tool senza path? Per write senza target -> deny fail-closed
          const c = checkPolicy(policy, perm);
          if (!c.allow) {
            const res = fail(def.name, def.metadata?.version ?? "1.0.0", "POLICY_DENIED", c.reason, Math.round(performance.now() - start));
            await audit.write({ time: new Date().toISOString(), tool: def.name, ok: false, durationMs: res.meta.durationMs, decision: "deny", reason: c.reason, cwd: ctx.cwd, sessionId: ctx.sessionId });
            return res;
          }
          // Blocco comandi pericolosi anche senza target (es. futuro bash_exec con cmd)
          const cmd = (args as Record<string, unknown>)["cmd"];
          if (typeof cmd === "string" && isDangerousCommand(cmd)) {
            const res = fail(def.name, def.metadata?.version ?? "1.0.0", "POLICY_DENIED", `dangerous command blocked: ${cmd.slice(0, 120)}`, Math.round(performance.now() - start));
            await audit.write({ time: new Date().toISOString(), tool: def.name, ok: false, durationMs: res.meta.durationMs, decision: "deny", reason: "dangerous command", cwd: ctx.cwd, sessionId: ctx.sessionId });
            return res;
          }
          // Approval gate: se c'è un approver umano, chiedi sempre per write/execute
          if (needsApproval(perm.action) && ctx.approver) {
            const decision = await ctx.approver({ tool: def.name, action: perm.action, targets, reason: "policy allow, need human accept" });
            if (decision !== "accept") {
              const res = fail(def.name, def.metadata?.version ?? "1.0.0", "NEED_APPROVAL", `denied by human (${decision})`, Math.round(performance.now() - start));
              await audit.write({ time: new Date().toISOString(), tool: def.name, ok: false, durationMs: res.meta.durationMs, decision: "need_approval", reason: "human denied", cwd: ctx.cwd, sessionId: ctx.sessionId });
              return res;
            }
          }
          continue;
        }
        for (const t of targets) {
          const c = checkPolicy(policy, perm, t);
          if (!c.allow) {
            const res = fail(def.name, def.metadata?.version ?? "1.0.0", "POLICY_DENIED", `${c.reason} (target ${t})`, Math.round(performance.now() - start), {
              permission: `${perm.domain}:${perm.action}`,
              target: t,
            });
            await audit.write({ time: new Date().toISOString(), tool: def.name, ok: false, durationMs: res.meta.durationMs, decision: "deny", reason: c.reason, cwd: ctx.cwd, sessionId: ctx.sessionId });
            return res;
          }
        }
        // Blocco comandi pericolosi con target (doppio controllo, non si sa mai)
        const cmdWithTargets = (args as Record<string, unknown>)["cmd"];
        if (typeof cmdWithTargets === "string" && isDangerousCommand(cmdWithTargets)) {
          const res = fail(def.name, def.metadata?.version ?? "1.0.0", "POLICY_DENIED", "dangerous command blocked", Math.round(performance.now() - start));
          await audit.write({ time: new Date().toISOString(), tool: def.name, ok: false, durationMs: res.meta.durationMs, decision: "deny", reason: "dangerous command", cwd: ctx.cwd, sessionId: ctx.sessionId });
          return res;
        }
        // Approval gate con target: policy ok, ora serve accept umano
        if (needsApproval(perm.action) && ctx.approver) {
          const decision = await ctx.approver({ tool: def.name, action: perm.action, targets, reason: "policy allow, need human accept" });
          if (decision !== "accept") {
            const res = fail(def.name, def.metadata?.version ?? "1.0.0", "NEED_APPROVAL", `denied by human (${decision}) for ${targets.join(", ")}`, Math.round(performance.now() - start), {
              permission: `${perm.domain}:${perm.action}`,
            });
            await audit.write({ time: new Date().toISOString(), tool: def.name, ok: false, durationMs: res.meta.durationMs, decision: "need_approval", reason: "human denied", cwd: ctx.cwd, sessionId: ctx.sessionId });
            return res;
          }
        }
      }

      const innerArgs: Parameters<ToolDefinition<TArgs, TOut>["execute"]>[0] =
        signal === undefined ? { args: effectiveArgs, ctx } : { args: effectiveArgs, ctx, signal };

      // Budget globale: se c'è un tetto e siamo oltre, blocca prima di eseguire
      if (ctx.budgetLimit !== undefined) {
        const { used } = await readUsage(ctx.cwd);
        const need = estimateArgsTokens(effectiveArgs);
        if (used + need > ctx.budgetLimit) {
          const res = fail(
            def.name,
            def.metadata?.version ?? "1.0.0",
            "BUDGET_EXCEEDED",
            `budget ${used + need} > ${ctx.budgetLimit} stimati`,
            Math.round(performance.now() - start),
          );
          await audit.write({ time: new Date().toISOString(), tool: def.name, ok: false, durationMs: res.meta.durationMs, decision: "deny", reason: "budget exceeded", cwd: ctx.cwd, sessionId: ctx.sessionId });
          return res;
        }
      }

      const res = await def.execute(innerArgs);
      // Traccia consumo args+result (best-effort, mai blocca)
      await recordUsage(ctx.cwd, estimateArgsTokens(effectiveArgs) + estimateTokens(JSON.stringify(res.data ?? res.error ?? "")));
      await audit.write({
        time: new Date().toISOString(),
        tool: def.name,
        ok: res.ok,
        durationMs: res.meta.durationMs,
        decision: "allow",
        cwd: ctx.cwd,
        sessionId: ctx.sessionId,
      });
      return res;
    },
  };
}
