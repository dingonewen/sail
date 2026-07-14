# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Sail is a terminal coding agent — a from-scratch rewrite of Pi using Mastra as a library. Users install it with `curl ... | sh`, then run `sail "fix the auth bug"` to get an interactive coding session.

## Tech Stack

- **Runtime:** Node.js 22+ with TypeScript (ESM, ES2022 target)
- **Package manager:** pnpm workspaces (monorepo)
- **Agent framework:** Mastra (`@mastra/core`) — used as a library, not a platform
- **Storage:** LibSQL via `@mastra/libsql`
- **CLI:** commander + chalk
- **Module resolution:** bundler

## Repository Structure

```
sail/
├── packages/
│   ├── core/       # @sail/core — Agent, tools, memory, observability, controller
│   ├── cli/        # @sail/cli — CLI entry point, args, session management
│   └── tui/        # @sail/tui — Terminal renderer, approval prompts
├── SPEC.md         # Project specification
├── IMPLEMENTATION_PLAN.md  # Step-by-step implementation checklist
└── install.sh      # One-command installer
```

## Commands

```bash
pnpm install                    # Install all dependencies
pnpm --filter @sail/core build  # Build core package
pnpm typecheck                  # Type-check all packages
```

## Key Design Rules

1. **Mastra is a library** — import only what we need (`Agent`, `createTool`, `Memory`). Don't use `mastra dev` server or platform features.
2. **Don't reuse Pi code** — this is a from-scratch rewrite. Reference Pi only for UX behavior.
3. **All files in English** — code, docs, configs, plans.
4. **Git commits:** no `Co-Authored-By` — only Yiwen Ding as contributor.
5. **Use `requireApproval: true`** on dangerous tools (bash, write_file, edit_file) — Mastra's built-in approval mechanism.

## Architecture

The agent loop is: User → CLI (commander args) → SailController → Agent.stream() → terminal (token-by-token)

Tools are defined via Mastra's `createTool()` with Zod schemas. Memory uses LibSQL + Mastra's `Memory` class with `workingMemory` (cross-session) and `observationalMemory` (auto-compaction). Observability uses `MastraStorageExporter`.
