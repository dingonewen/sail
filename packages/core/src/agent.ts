import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { createWorkspaceTools } from "@mastra/core/workspace";
import { z } from "zod";
import { createMemory } from "./memory.js";
import { createSailWorkspace } from "./workspace.js";
import { createSubagents } from "./subagents.js";

let _agent: Agent | null = null;

const webFetchTool = createTool({
  id: "web_fetch",
  description:
    "Fetch a URL and return its content as plain text. Use to look up documentation, API references, release notes, or error messages.",
  inputSchema: z.object({
    url: z.string().describe("The URL to fetch (https://...)"),
    maxChars: z.number().default(20000).describe("Max characters to return"),
  }),
  execute: async (params) => {
    const res = await fetch(params.url, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/g, " ")
      .replace(/\s{2,}/g, "\n")
      .trim();
    return { text: text.slice(0, params.maxChars), url: params.url };
  },
});

/** Read-only tools (safe, no approval needed — shared with reviewer + explorer) */
const READ_ONLY_TOOLS = new Set([
  "mastra_workspace_read_file",
  "mastra_workspace_grep",
  "mastra_workspace_list_files",
  "mastra_workspace_file_stat",
  "mastra_workspace_search",
  "web_fetch",
]);

export async function getAgent(): Promise<Agent> {
  if (_agent) return _agent;

  const workspace = createSailWorkspace();
  const allTools = {
    ...(await createWorkspaceTools(workspace)),
    web_fetch: webFetchTool,
  };
  const memory = createMemory();

  // Split tools: read-only for reviewer/explorer, full set for fixer
  const readOnlyTools: Record<string, any> = {};
  for (const [name, tool] of Object.entries(allTools)) {
    if (READ_ONLY_TOOLS.has(name)) {
      readOnlyTools[name] = tool;
    }
  }

  const subagents = createSubagents(workspace, allTools, readOnlyTools, memory);

  _agent = new Agent({
    id: "sail-agent",
    name: "Sail",
    description:
      "A terminal coding agent that reads, writes, edits, searches, and executes commands to help you build software. Delegates complex tasks to specialized subagents.",
    instructions: `
You are Sail, an expert software engineer and coding supervisor running in the terminal.

## Your Team
You have specialised subagents you can delegate to:
- **code-reviewer** — reviews code for bugs, security issues, and performance problems. Use for audits, quality checks, pull request reviews.
- **code-explorer** — explores codebases, traces dependencies, answers "how does X work" questions. Use for understanding unfamiliar code.
- **code-fixer** — makes actual changes: writes files, edits code, runs commands. Use for implementing fixes, features, refactoring.

## How You Work
1. Understand the user's request
2. Decide: handle it yourself, or delegate to a subagent
   - Simple questions → answer directly
   - Code review requests → delegate to code-reviewer
   - Codebase exploration → delegate to code-explorer
   - Code changes → delegate to code-fixer
   - Complex multi-step tasks → coordinate multiple subagents
3. Synthesise subagent results into a clear response for the user
4. Ask clarifying questions when the request is ambiguous

## Communication
- Be concise and direct — the user is a developer too
- When delegating, briefly tell the user which agent is handling it
- Report what was done and why after completing a task

## Safety
- Dangerous tools require user approval — the user will be prompted
- For shell commands, prefer non-destructive operations
- Never run destructive commands without explicit user direction
`,
    model: process.env.SAIL_MODEL || "anthropic/claude-sonnet-4-6",
    tools: allTools,
    workspace,
    memory,
    agents: subagents,
    // Enable parallel subagent execution: subagents run as background tasks
    // so the supervisor can delegate to multiple agents concurrently.
    backgroundTasks: {
      tools: {
        "code-reviewer": { enabled: true, timeoutMs: 300_000 },
        "code-explorer": { enabled: true, timeoutMs: 300_000 },
        "code-fixer": { enabled: true, timeoutMs: 600_000 },
      },
    },
  });

  return _agent;
}
