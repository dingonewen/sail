import { Agent } from "@mastra/core/agent";
import { createWorkspaceTools } from "@mastra/core/workspace";
import { createMemory } from "./memory.js";
import { createSailWorkspace } from "./workspace.js";
import { createSubagents } from "./subagents.js";

let _agent: Agent | null = null;

/** Get the supervisor agent instance with subagents (lazy init) */
export async function getAgent(): Promise<Agent> {
  if (_agent) return _agent;

  const workspace = createSailWorkspace();
  const tools = await createWorkspaceTools(workspace);
  const memory = createMemory();
  const subagents = createSubagents(workspace, tools, memory);

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
    tools,
    workspace,
    memory,
    agents: subagents,
  });

  return _agent;
}
