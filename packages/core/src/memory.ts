import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { resolve } from "node:path";
import { homedir } from "node:os";

export function createMemory(): Memory {
  const dbPath =
    process.env.SAIL_DB_PATH || resolve(homedir(), ".sail", "sail.db");

  return new Memory({
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

      // Automatic memory compaction for long conversations
      observationalMemory: true,
    },
  });
}
