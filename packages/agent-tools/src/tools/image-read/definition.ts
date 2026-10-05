import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { imageReadLogic, IMAGE_READ_VERSION, type ImageReadInput, type ImageReadOutput } from "./logic.js";
import { imageReadPermissions } from "./permissions.js";

export const imageReadDefinition: ToolDefinition<ImageReadInput, ImageReadOutput> = {
  name: "image_read",
  label: "Image read",
  description: "Legge png/jpg/webp/gif/pdf dentro cwd: base64 per modelli vision + testo best-effort per PDF. Solo lettura.",
  category: "filesystem",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path relativo al cwd" },
      maxBytes: { type: "number", description: "1024..20000000, default 5000000" },
    },
    required: ["path"],
    additionalProperties: false,
  },
  permissions: imageReadPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: IMAGE_READ_VERSION, since: "0.15.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<ImageReadOutput>> {
    return withTiming("image_read", IMAGE_READ_VERSION, () => imageReadLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "IMAGE_FAILED", message: err.message ?? String(e) };
    });
  },
};
