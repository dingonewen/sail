import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { getConfigDir } from "./config.js";

/**
 * Discover and load context files (AGENTS.md, CLAUDE.md, SYSTEM.md).
 * Searches from cwd up to the filesystem root, plus ~/.sail/agent/.
 */
export function loadContextFiles(cwd: string): {
  agentsMd: string[];
  systemPrompt: string | null;
} {
  const agentsMd: string[] = [];
  let systemPrompt: string | null = null;

  // Walk up from cwd looking for AGENTS.md / CLAUDE.md
  let dir = cwd;
  while (true) {
    const candidates = [
      join(dir, "AGENTS.md"),
      join(dir, "CLAUDE.md"),
      join(dir, ".agents", "AGENTS.md"),
      join(dir, ".claude", "CLAUDE.md"),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate) && !agentsMd.some((m) => m.includes(candidate))) {
        try {
          const content = readFileSync(candidate, "utf-8");
          agentsMd.unshift(content); // prepend — closest to cwd first
        } catch {
          // skip unreadable files
        }
      }
    }

    // Check for SYSTEM.md (only the first one found, closest to cwd)
    if (!systemPrompt) {
      const systemPath = join(dir, "SYSTEM.md");
      if (existsSync(systemPath)) {
        try {
          systemPrompt = readFileSync(systemPath, "utf-8");
        } catch {
          // skip
        }
      }
    }

    const parent = dirname(dir);
    if (parent === dir) break; // Reached filesystem root
    dir = parent;
  }

  // Load global agent instructions from ~/.sail/agent/
  const globalAgentDir = join(getConfigDir(), "agent");
  if (existsSync(globalAgentDir)) {
    try {
      const files = readdirSync(globalAgentDir)
        .filter((f) => f.endsWith(".md"))
        .sort();
      for (const file of files) {
        try {
          agentsMd.push(readFileSync(join(globalAgentDir, file), "utf-8"));
        } catch {
          // skip
        }
      }
    } catch {
      // skip
    }
  }

  return { agentsMd, systemPrompt };
}
