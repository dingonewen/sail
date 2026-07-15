import { Agent } from "@mastra/core/agent";
import type { Workspace } from "@mastra/core/workspace";

/**
 * Create specialized subagents with tool-level access control.
 *
 * - code-reviewer & code-explorer: read-only tools (no write/bash/delete)
 * - code-fixer: full tool access
 *
 * Delegation is handled by the supervisor's LLM, which reads each
 * subagent's `description` to decide routing.
 */
export function createSubagents(
  workspace: Workspace,
  allTools: Record<string, any>,
  readOnlyTools: Record<string, any>,
  memory: any,
): Record<string, Agent> {
  const baseConfig = {
    model: process.env.SAIL_MODEL || "anthropic/claude-sonnet-4-6",
  };

  return {
    "code-reviewer": new Agent({
      ...baseConfig,
      id: "code-reviewer",
      name: "Code Reviewer",
      description:
        "Reviews code for bugs, security issues, style violations, and performance problems. " +
        "Returns a structured review with findings ranked by severity. " +
        "READ-ONLY — cannot modify files or run commands. " +
        "Use when the user asks for code review, audit, or quality check.",
      instructions: `
You are a senior code reviewer. Use the \`skill\` tool to load the code-review skill for your full review checklist and output format. Be thorough — focus on correctness and security first.
      `,
      tools: readOnlyTools,
      workspace,
      memory,
    }),

    "code-explorer": new Agent({
      ...baseConfig,
      id: "code-explorer",
      name: "Code Explorer",
      description:
        "Explores codebases to answer questions about structure, architecture, and dependencies. " +
        "Reads files, searches for patterns, and traces call chains. " +
        "READ-ONLY — cannot modify files or run commands. " +
        "Use when the user asks 'how does X work', 'where is Y defined', or 'what depends on Z'.",
      instructions: `
You are a codebase navigator. Use the \`skill\` tool to load the code-exploration skill for your search strategy and output format. Understand thoroughly — don't guess.
      `,
      tools: readOnlyTools,
      workspace,
      memory,
    }),

    "code-fixer": new Agent({
      ...baseConfig,
      id: "code-fixer",
      name: "Code Fixer",
      description:
        "Implements code changes — writes new files, edits existing code, and runs commands. " +
        "Has FULL tool access including write, edit, delete, and bash. " +
        "Use when the user asks to fix a bug, add a feature, refactor code, or run a command. " +
        "Always verify changes by reading back modified files or running tests.",
      instructions: `
You are a hands-on software engineer. Use the \`skill\` tool to load the code-fixing skill for your editing workflow and verification checklist. Follow existing patterns. Handle errors gracefully.
      `,
      tools: allTools,
      workspace,
      memory,
    }),
  };
}
