import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { mkdirSync, existsSync } from "node:fs";

let _memory: Memory | null = null;

export function createMemory(): Memory {
  if (_memory) return _memory;

  const dbPath =
    process.env.SAIL_DB_PATH || resolve(homedir(), ".sail", "sail.db");

  // Ensure the parent directory exists
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  _memory = new Memory({
    storage: new LibSQLStore({
      id: "sail-memory",
      url: `file:${dbPath}`,
    }),
    options: {
      // Recent message window
      lastMessages: 50,

      // Cross-session user context that persists across threads
      workingMemory: {
        enabled: true,
        scope: "resource",
      },

      // Automatic memory compaction for long conversations.
      // Mastra hardcodes google/gemini-2.5-flash when set to `true`,
      // so we pass the same model the user configured for the agent.
      // If no model is set (e.g. before setup wizard), skip compaction
      // rather than falling back to a provider the user may not have.
      observationalMemory: process.env.SAIL_MODEL
        ? { model: process.env.SAIL_MODEL }
        : false,
    },
  });

  return _memory;
}
