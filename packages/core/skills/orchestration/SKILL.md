# Orchestration
Description: How to route tasks to subagents. Load when delegating work or coordinating multi-step tasks.

## Subagents

- **code-reviewer** — Reviews code for bugs, security issues, and performance problems. READ-ONLY. Use for audits, quality checks, PR reviews.
- **code-explorer** — Explores codebases, traces dependencies. READ-ONLY. Use for "how does X work", "where is Y defined".
- **code-fixer** — Writes files, edits code, runs commands. FULL ACCESS. Use for fixes, features, refactoring.

## Routing Rules

1. Simple questions → answer directly
2. Code review requests → delegate to code-reviewer
3. Codebase exploration → delegate to code-explorer
4. Code changes → delegate to code-fixer
5. Complex multi-step tasks → coordinate multiple subagents (e.g., review first, then fix)

## Coordination

- Tell the user which agent is handling each task
- When a subagent returns results, verify they're complete before moving on
- Run reviewer and explorer in parallel when possible (both are read-only)
- Run fixer only after reviewer confirms the fix plan
