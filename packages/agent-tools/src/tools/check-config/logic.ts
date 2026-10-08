import { promises as fs } from "node:fs";
import { resolveSafePath, type ToolContext } from "../../core/context.js";

export interface CheckConfigInput {
  paths?: string[];
}

export interface ConfigIssue {
  path: string;
  rule: string;
  severity: "error" | "warning";
  message: string;
}

export interface CheckConfigOutput {
  issues: ConfigIssue[];
  summary: string;
  checked: number;
}

export const CHECK_CONFIG_VERSION = "1.0.0";

async function checkPackageJson(ctx: ToolContext, rel: string, abs: string, issues: ConfigIssue[]): Promise<boolean> {
  let raw: string;
  try {
    raw = await fs.readFile(abs, "utf8");
  } catch {
    return false;
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    issues.push({ path: rel, rule: "json-valid", severity: "error", message: "package.json non valido" });
    return true;
  }
  if (typeof data["name"] !== "string")
    issues.push({ path: rel, rule: "pkg-name", severity: "warning", message: "manca campo name" });
  if (typeof data["scripts"] !== "object" || data["scripts"] === null)
    issues.push({ path: rel, rule: "pkg-scripts", severity: "warning", message: "manca scripts" });
  const engines = data["engines"] as Record<string, unknown> | undefined;
  if (!engines || typeof engines["node"] !== "string")
    issues.push({ path: rel, rule: "pkg-engines", severity: "warning", message: "manca engines.node" });
  return true;
}

async function checkTsconfig(rel: string, abs: string, issues: ConfigIssue[]): Promise<boolean> {
  let raw: string;
  try {
    raw = await fs.readFile(abs, "utf8");
  } catch {
    return false;
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    issues.push({ path: rel, rule: "json-valid", severity: "error", message: "tsconfig non valido" });
    return true;
  }
  const co = (data["compilerOptions"] ?? {}) as Record<string, unknown>;
  if (co["strict"] !== true)
    issues.push({
      path: rel,
      rule: "ts-strict",
      severity: "warning",
      message: "compilerOptions.strict dovrebbe essere true",
    });
  if (co["outDir"] !== undefined && co["outDir"] === co["rootDir"])
    issues.push({ path: rel, rule: "ts-outdir", severity: "error", message: "outDir uguale a rootDir" });
  return true;
}

export async function checkConfigLogic(ctx: ToolContext, input: CheckConfigInput): Promise<CheckConfigOutput> {
  const rawPaths = input.paths && input.paths.length > 0 ? input.paths : ["."];
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) throw Object.assign(new Error(`path escapes cwd: ${p}`), { code: "PATH_TRAVERSAL" });
  }
  const issues: ConfigIssue[] = [];
  let checked = 0;
  for (const p of rawPaths) {
    const r = resolveSafePath(ctx, p);
    if (!r.ok) continue;
    const pkgRel = p === "." ? "package.json" : `${p.replace(/\/$/, "")}/package.json`;
    const tsRel = p === "." ? "tsconfig.json" : `${p.replace(/\/$/, "")}/tsconfig.json`;
    const pkg = resolveSafePath(ctx, pkgRel);
    const tsc = resolveSafePath(ctx, tsRel);
    if (pkg.ok && (await checkPackageJson(ctx, pkgRel, pkg.abs, issues))) checked++;
    if (tsc.ok && (await checkTsconfig(tsRel, tsc.abs, issues))) checked++;
  }
  const errors = issues.filter((i) => i.severity === "error").length;
  const summary =
    checked === 0 ? "nessun config trovato" : `${checked} file, ${issues.length} issue (${errors} errori)`;
  ctx.logger.info("check_config", { checked, issues: issues.length });
  return { issues: issues.slice(0, 50), summary, checked };
}
