import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import { resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { mkdirSync, existsSync } from "node:fs";

let _memory: Memory | null = null;

/** Map chat provider → embedding model (same API key, no extra config) */
function resolveEmbedder(): string | undefined {
  const model = process.env.SAIL_MODEL;
  if (!model) return undefined;
  const provider = model.split("/")[0]?.toLowerCase();

  const embedderMap: Record<string, string> = {
    openai: "openai/text-embedding-3-small",
    google: "google/gemini-embedding-001",
  };

  return embedderMap[provider];
}

export function createMemory(): Memory {
  if (_memory) return _memory;

  const dbPath =
    process.env.SAIL_DB_PATH || resolve(homedir(), ".sail", "sail.db");
  const vectorPath = dbPath.replace(/\.db$/, "-vectors.db");
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const embedder = resolveEmbedder();
  const semanticRecall = embedder &&
    process.env.SAIL_SEMANTIC_RECALL !== "false";

  _memory = new Memory({
    storage: new LibSQLStore({
      id: "sail-memory",
      url: `file:${dbPath}`,
    }),
    ...(semanticRecall && embedder ? {
      vector: new LibSQLVector({
        id: "sail-vector",
        url: `file:${vectorPath}`,
      }),
      embedder,
    } : {}),
    options: {
      lastMessages: 50,

      workingMemory: {
        enabled: true,
        scope: "resource",
      },

      observationalMemory: process.env.SAIL_MODEL
        ? { model: process.env.SAIL_MODEL }
        : false,

      // Semantic recall: vector search across conversation history.
      // Auto-detects embedding model from the user's configured provider.
      // Uses the same API key — no extra configuration needed.
      // Disable with SAIL_SEMANTIC_RECALL=false
      semanticRecall: semanticRecall && embedder ? {
        topK: 4,
        scope: "resource",
        messageRange: { before: 1, after: 1 },
      } : false,
    },
  });

  return _memory;
}
