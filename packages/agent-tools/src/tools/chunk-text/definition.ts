import { withTiming, type AgentToolResult } from "../../core/result.js";
import { DEFAULT_TIMEOUT_MS, type ToolDefinition } from "../../core/types.js";
import { chunkTextLogic, CHUNK_TEXT_VERSION, type ChunkTextInput, type ChunkTextOutput } from "./logic.js";
import { chunkTextPermissions } from "./permissions.js";

export const chunkTextDefinition: ToolDefinition<ChunkTextInput, ChunkTextOutput> = {
  name: "chunk_text",
  label: "Chunk text",
  description: "Divide testo in chunk con overlap per RAG. Puro, non tocca disco. Port nativo di chunker.py.",
  category: "other",
  parameters: {
    type: "object",
    properties: {
      text: { type: "string" },
      max_chars: { type: "number", description: "100..50000, default 1000" },
      overlap: { type: "number", description: "0..max_chars-1, default 100" },
    },
    required: ["text"],
    additionalProperties: false,
  },
  permissions: chunkTextPermissions,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  metadata: { version: CHUNK_TEXT_VERSION, since: "0.11.0" },
  async execute({ args, ctx }): Promise<AgentToolResult<ChunkTextOutput>> {
    return withTiming("chunk_text", CHUNK_TEXT_VERSION, () => chunkTextLogic(ctx, args), (e: unknown) => {
      const err = e as Error & { code?: string };
      return { code: err.code ?? "CHUNK_FAILED", message: err.message ?? String(e) };
    });
  },
};
