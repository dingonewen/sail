import { Agent } from "@mastra/core/agent";
import type { Workspace } from "@mastra/core/workspace";

/**
 * Create specialized subagents for task delegation.
 * All share the same workspace and tools; differentiation is via
 * instructions and description (used by supervisor for routing).
 */
export function createSubagents(
  workspace: Workspace,
  tools: Record<string, any>,
  memory: any,
): Record<string, Agent> {
  const baseConfig = {
    model: process.env.SAIL_MODEL || "anthropic/claude-sonnet-4-6",
  };

  return {
    /** Reviews code for bugs, style, performance — read-focused */
    "code-reviewer": new Agent({
      ...baseConfig,
      id: "code-reviewer",
      name: "Code Reviewer",
      description:
        "Reviews code for bugs, security issues, style violations, and performance problems. " +
        "Returns a structured review with findings ranked by severity. " +
        "Use when the user asks for code review, audit, or quality check.",
      instructions: `
You are a senior code reviewer. When asked to review code:

1. Read the relevant files thoroughly
2. Identify bugs, security issues, style violations, and performance problems
3. Rank findings by severity: critical, high, medium, low
4. For each finding, explain:
   - The problem
   - Why it matters
   - A concrete fix suggestion (but do NOT apply the fix yourself)
5. End with a summary: total findings by severity

Be thorough but practical — flag real problems, not nitpicks. Focus on correctness and security first.
      `,
      tools,
      workspace,
      memory,
    }),

    /** Explores and understands codebases — read-only navigation */
    "code-explorer": new Agent({
      ...baseConfig,
      id: "code-explorer",
      name: "Code Explorer",
      description:
        "Explores codebases to answer questions about structure, architecture, and dependencies. " +
        "Reads files, searches for patterns, and traces call chains. " +
        "Use when the user asks 'how does X work', 'where is Y defined', or 'what depends on Z'.",
      instructions: `
You are a codebase navigator. When asked to explore code:

1. Start by listing relevant directories and searching for key patterns
2. Read important files to understand the architecture
3. Trace dependencies and call chains
4. Provide clear, structured answers:
   - What files are involved
   - How they connect
   - Key functions/classes and their roles
5. If something is unclear, say so — don't guess

Be thorough. Your job is to understand, not to change anything.
      `,
      tools,
      workspace,
      memory,
    }),

    /** Makes actual changes — writes, edits, runs commands */
    "code-fixer": new Agent({
      ...baseConfig,
      id: "code-fixer",
      name: "Code Fixer",
      description:
        "Implements code changes — writes new files, edits existing code, and runs commands. " +
        "Use when the user asks to fix a bug, add a feature, refactor code, or run a command. " +
        "Always verify changes by reading back modified files or running tests.",
      instructions: `
You are a hands-on software engineer. When asked to make changes:

1. Understand the task and read relevant files
2. Plan your approach before touching code
3. Make precise, minimal edits — prefer targeted changes over rewrites
4. After each change:
   - Read back the modified file to verify correctness
   - Run relevant tests or linters if available
5. Report what you changed and why

Follow existing code patterns. Don't introduce new dependencies without reason. Handle errors gracefully.
      `,
      tools,
      workspace,
      memory,
    }),
  };
}
