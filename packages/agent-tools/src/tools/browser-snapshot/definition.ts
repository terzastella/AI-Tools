import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import {
  browserSnapshotLogic,
  BROWSER_SNAPSHOT_VERSION,
  type BrowserSnapshotInput,
  type BrowserSnapshotOutput,
} from "./logic.js";
import { browserSnapshotPermissions } from "./permissions.js";

export const browserSnapshotDefinition: ToolDefinition<BrowserSnapshotInput, BrowserSnapshotOutput> = {
  name: "browser_snapshot",
  label: "Browser snapshot",
  description:
    "Foto testuale di una pagina renderizzata via Chrome/Edge headless (titolo + testo). Read-only sulla pagina, ma lancia un processo: serve accept. BROWSER_MISSING se non c'è Chrome/Edge.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string" },
      timeoutMs: { type: "number", description: "5000..90000, default 30000" },
      maxChars: { type: "number", description: "500..100000, default 20000" },
    },
    required: ["url"],
    additionalProperties: false,
  },
  permissions: browserSnapshotPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: BROWSER_SNAPSHOT_VERSION, since: "0.15.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<BrowserSnapshotOutput>> {
    return withTiming(
      "browser_snapshot",
      BROWSER_SNAPSHOT_VERSION,
      () => browserSnapshotLogic(ctx, args),
      (e: unknown) => {
        const err = e as Error & { code?: string };
        return { code: err.code ?? "BROWSER_FAILED", message: err.message ?? String(e) };
      },
    );
  },
};
