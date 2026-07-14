# SPEC: Build a Pi-like Coding Agent on Mastra

## Goal

Build a terminal coding agent that can be installed and used the same way as
Pi (`omp.sh`) or Claude Code — the user types a command, the agent works on a
coding problem interactively.

**One-line test:** `curl ... | sh` installs it, then `my-pi "fix the auth bug"`
produces a working coding session.

---

## Reference Points

| Reference | What to learn from it |
|---|---|
| **Pi (`earendil-works/pi`)** | ~300-line core: agent loop, tree-structured session memory with compaction, extension system |
| **Oh My Pi (`can1357/oh-my-pi`)** | What a production Pi looks like: subagents, 32 tools, LSP, MCP, hindsight memory, flow rules |
| **Claude Code (this CLI)** | User experience: streaming text, tool approval prompts, session management, memory compaction in long conversations |
| **This course (`harness/`)** | Concept understanding: agent loop (L1), durable execution (L2), sandbox (L3), memory (L4), handoff (L5), supervisor (L6), HITL (L7) |

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Model calls | **Vercel AI SDK** (`ai` + provider packages) | Unified API across 40+ model providers |
| Agent runtime | **Mastra** (`@mastra/core`) — as a library, not a platform | Replaces Pi's hand-rolled agent-core |
| Runtime | **Node.js / Bun** | Pi uses Bun; decide based on Mastra compatibility |
| CLI | Custom (reference: Pi's `pi-coding-agent`) | Your application layer |
| TUI | Custom or library (reference: Pi's `pi-tui`) | Terminal rendering |
| Storage | **PostgreSQL** or **libSQL** (via Mastra storage) | Session persistence, memory |

---

## Mastra Modules: What We Use, What We Skip

**Use:**
- `Agent` + `agent.generate()` — agent loop (replaces Pi's hand-rolled while loop)
- `createTool()` — tool definitions with Zod schemas
- `Memory` — conversation history, tree-structured session memory, compaction
- `Observability` — OpenTelemetry tracing (at minimum structured logging)

**Maybe later:**
- `SupervisorAgent` — for subagent dispatch in extensions
- `MCP` — MCP server integration
- `Approval` — human-in-the-loop for dangerous tools

**Skip (not needed for MVP):**
- `Workflow` — Pi is conversational, not a DAG of predefined steps
- `RAG` — not a document Q&A agent
- `Voice` — terminal-based, no speech
- `Channels` — no Slack/Discord integration
- `Evals` — add when we have something to evaluate
- `Guardrails` — add when we have defined safety requirements

---

## Features (MVP)

### Must Have

1. **Agent Loop**
   - User sends a message → model decides → tool calls → execute → repeat
   - Streaming text output (model responses appear token-by-token in terminal)
   - Powered by Mastra `Agent.generate()` — not a hand-written while loop

2. **Coding Tools** (minimum viable set)
   - `read_file(path)` — read file contents
   - `write_file(path, content)` — create/overwrite a file
   - `edit_file(path, old, new)` — string replacement edit
   - `search(pattern, path?)` — grep/search in project
   - `bash(command)` — run shell command (with approval)
   - `list_dir(path)` — list directory contents

3. **Session Memory**
   - Tree-structured conversation history (like Pi)
   - Memory compaction for long conversations (like course L4)
   - Cross-session memory: resume a previous session
   - Powered by Mastra `Memory`

4. **Human-in-the-Loop**
   - Dangerous tools (`bash`, `write_file`, `edit_file`) require user approval
   - User can `[Allow]` or `[Deny]` each dangerous operation
   - Powered by Mastra `Agent.approval.tools` or custom implementation

5. **Observability**
   - Minimum: structured logging of every tool call (name, args, result, duration)
   - Every model turn logged (tokens used, latency)
   - Upgrade path to OpenTelemetry via Mastra's observability module

6. **Installation**
   - Single command install: `curl ... | sh` or `npm install -g my-pi`
   - Works on macOS and Linux

### Nice to Have (Post-MVP)

7. **Extension System**
   - Users can author custom tools as extensions
   - Extensions can define sub-agents (delegation pattern, like course L6)
   - MCP server support

8. **Editor Integration**
   - LSP integration for precise edits
   - Hash-anchored edits (like OMP)

9. **Multi-Model**
   - Configurable model provider string (like Mastra's `provider/model` format)
   - User can switch between OpenAI / Anthropic / local models

---

## Architecture

```
my-pi/
  packages/
    core/               ← Mastra Agent definitions + tools
      agent.ts          ← Main coding agent (instructions + tools)
      tools/
        read.ts         ← read_file tool
        write.ts        ← write_file tool
        edit.ts         ← edit_file tool
        search.ts       ← search tool
        bash.ts         ← bash tool (dangerous, requires approval)
        list.ts         ← list_dir tool
      memory.ts         ← Memory configuration (tree-structured sessions)
      index.ts          ← Export the agent instance
    cli/                ← CLI entry point
      main.ts           ← Parse args, start session, handle input loop
      session.ts        ← Session management (new, resume, list)
    tui/                ← Terminal UI
      renderer.ts       ← Streaming output renderer
      prompt.ts         ← Approval prompt (Allow/Deny UI)
      index.ts          ← TUI exports
  CLAUDE.md             ← Project instructions for AI assistants
  SPEC.md               ← This file
  package.json          ← Monorepo root (pnpm workspaces or npm workspaces)
```

---

## Key Design Decisions (for the AI agent building this)

1. **Mastra as a library, not a framework.** Import only `Agent`, `createTool`, `Memory`. Do not set up Mastra's server, workflows, or RAG unless explicitly asked.

2. **Pi's tree-structured memory means conversations branch.** A single user task can spawn sub-conversations. Mastra's `Memory` with thread-based scoping should map to this.

3. **Tools follow Mastra's `createTool()` pattern** — Zod inputSchema + async execute. The agent does NOT use the Vercel AI SDK `tool()` function directly; all tools go through Mastra.

4. **Approval is declarative where possible.** Mastra's `approval.tools: [...]` vs. rolling our own — prefer Mastra's built-in, fall back to custom if it doesn't support the UX we need.

5. **Every tool call is logged.** Console.log at minimum. Structured JSON logs as the default. OpenTelemetry as the upgrade path via Mastra's observability module.

6. **Model provider is configurable.** Default to a reasonable provider. User can override via environment variable or config file. Mastra's `provider/model` string format.

---

## Non-Goals (for MVP)

- No web UI or browser-based interface
- No multi-user or team features
- No deployment platform / cloud service
- No RAG over documentation
- No voice interface
- No Slack/Discord bot
- No pre-built CI/CD integration
