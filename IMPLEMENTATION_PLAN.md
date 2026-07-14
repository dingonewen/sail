# Sail — Implementation Plan

> From-scratch rewrite of Pi using Mastra as a library. Check off each item as completed.

---

## Phase 1: Project Scaffolding

- [x] 1.1 Initialize monorepo root (`package.json` + `pnpm-workspace.yaml`)
- [x] 1.2 Create `packages/core/`, `packages/cli/`, `packages/tui/` sub-packages
- [x] 1.3 Configure TypeScript (root `tsconfig.json` + per-package `tsconfig.json`)
- [x] 1.4 Install dependencies: `@mastra/core`, `@mastra/memory`, `@mastra/libsql`, `@mastra/observability`, `zod`, `chalk`, `commander`, etc.
- [x] 1.5 Verify `tsc --noEmit` passes

---

## Phase 2: Core — Tool Definitions

- [x] 2.1 `read_file` — read file contents, support line range
- [x] 2.2 `write_file` — create/overwrite file (use `requireApproval: true`)
- [x] 2.3 `edit_file` — string replacement edit (use `requireApproval: true`)
- [x] 2.4 `search` — grep search (supports pattern + path)
- [x] 2.5 `bash` — execute shell command (use `requireApproval: true`)
- [x] 2.6 `list_dir` — list directory contents
- [x] 2.7 All tools defined via Mastra `createTool()` + Zod schema
- [x] 2.8 Verify each tool can be called independently

---

## Phase 3: Core — Agent Definition

- [x] 3.1 Write Agent system instructions (coding assistant persona)
- [x] 3.2 Attach all tools to Agent
- [x] 3.3 Configure Mastra `Memory` (`@mastra/memory` + LibSQL storage)
  - [x] `lastMessages: 50` — recent message window
  - [x] `workingMemory: { enabled: true, scope: "resource" }` — cross-session user context
  - [x] `semanticRecall` — vector search across history (optional)
- [x] 3.4 Enable `observationalMemory: true` for automatic memory compaction on long conversations
- [x] 3.5 Configure `Observability` (structured logging + OpenTelemetry via `MastraStorageExporter`)
- [x] 3.6 Create `Mastra` instance, register agent
- [x] 3.7 Create `AgentController` — manages threads, modes, event subscriptions (bridge between core and TUI)
- [x] 3.8 Verify `agent.generate()` works end-to-end

---

## Phase 4: CLI — Entry Point + Argument Parsing

- [x] 4.1 Parse CLI arguments (reference Pi's arg design)
  - [x] Positional args: initial prompt
  - [x] `--provider` / `--model` / `--api-key`
  - [x] `--continue` / `--resume` / `--session` / `--fork`
  - [x] `--print` / `-p` non-interactive mode
  - [x] `--mode json` JSON event stream
  - [x] `--name` named session
  - [x] `--no-session` ephemeral session
  - [x] `--tools` / `--exclude-tools` tool filtering
  - [x] `--thinking` reasoning level
  - [x] `--help` / `--version`
- [x] 4.2 Config loading (env vars + config file `~/.sail/config.json`)
- [x] 4.3 Model list command (`--list-models`)

---

## Phase 5: CLI — Session Management

- [x] 5.1 Session data model: id, name, threadId, parentId (tree branching), createdAt, updatedAt
- [x] 5.2 Session storage: JSON file index + Mastra Memory (LibSQL) for conversation history
- [x] 5.3 Create new session (`sail "prompt"`) → new thread via `AgentController`
- [x] 5.4 Resume session (`sail --resume` pick from list) → select existing thread
- [x] 5.5 Continue last session (`sail --continue`) → select most recent thread
- [x] 5.6 Fork session (`sail --fork <id>`) → `memory.cloneThread()` to branch from a point
- [x] 5.7 Tree-structured session navigation (`/tree` command, session list with parent/child relationships)
- [x] 5.8 List historical sessions

---

## Phase 6: TUI — Interactive Interface (powered by AgentController)

- [x] 6.1 Streaming output renderer — subscribe to `AgentController` events, render token-by-token
  - [x] `message_update` → append text chunks to terminal
  - [x] `tool_call_start` / `tool_call_end` → show tool execution status
  - [x] `mode_change` → update mode indicator
  - [x] `error` → display error
- [x] 6.2 Tool approval UI — driven by `createTool({ requireApproval: true })`
  - [x] Show tool name + params when approval event fires
  - [x] `[A]llow / [D]eny / [Y]es to all` interaction
  - [x] Timeout defaults to deny
- [x] 6.3 Agent modes (via `AgentController.modes`)
  - [x] `chat` mode — default conversational coding
  - [x] `plan` mode — analyze before making changes
  - [x] `build` mode — execute changes
- [ ] 6.4 Steering messages (Enter to interrupt/send, Alt+Enter for follow-up)
- [ ] 6.5 Keyboard shortcuts:
  - [ ] `Ctrl+C` interrupt
  - [ ] `Ctrl+L` switch model
  - [x] `/model` command
  - [x] `/mode` switch agent mode
  - [x] `/tree` view session tree

---

## Phase 7: HITL — Human-in-the-Loop Approval

- [x] 7.1 Tool classification: safe (read_file, search, list_dir) vs dangerous (bash, write_file, edit_file)
- [x] 7.2 Dangerous tools use Mastra's built-in `requireApproval: true` (no custom interception needed)
- [ ] 7.3 TUI handles approval events from `AgentController` event stream
- [x] 7.4 `--approve` / `--no-approve` global flags (auto-approve or always-deny dangerous tools)

---

## Phase 8: Integration — Wire Everything Together

- [x] 8.1 Interactive mode: CLI args → SailController → Agent.stream() → token-by-token output
- [x] 8.2 Non-interactive mode (`-p` flag): `agent.generate()` → print `response.text` → exit
- [ ] 8.3 JSON mode (`--mode json`): emit structured JSON event stream
- [ ] 8.4 End-to-end test: `sail "read package.json and tell me the project name"`

---

## Phase 9: Installation & Deployment

- [x] 9.1 Write `install.sh` (detect Node.js ≥22 → npm install -g → verify)
- [x] 9.2 npm publish config (`package.json` bin field, etc.)
- [ ] 9.3 Verify one-command install: `curl -fsSL https://.../install.sh | sh`
- [ ] 9.4 Verify macOS + Linux compatibility

---

## Phase 10: AGENTS.md Context Loading

- [x] 10.1 Auto-discover and load `AGENTS.md` / `CLAUDE.md` (walk up from cwd to root)
- [x] 10.2 Support `~/.sail/agent/` global instruction files
- [x] 10.3 Support `SYSTEM.md` override/append system prompt
- [x] 10.4 `--no-context-files` disable flag

---

## Phase 11: Testing & Polish

 - [ ] 11.1 Core tool unit tests (each tool independently)
 - [ ] 11.2 Agent integration test (mock model provider)
 - [ ] 11.3 CLI argument parsing tests
 - [ ] 11.4 Session management tests
 - [ ] 11.5 Manual end-to-end smoke test

---

## Phase 12: Post-MVP (Optional)

 - [ ] 12.1 Multi-model support (function-based `model: (ctx) => "provider/model"`)
 - [ ] 12.2 Extension system (TypeScript module dynamic loading)
 - [ ] 12.3 Subagents — `agent.agents: { reviewer, debugger }` (built into Mastra Agent class)
 - [ ] 12.4 MCP server integration
 - [ ] 12.5 LSP integration for precise edits
 - [ ] 12.6 `--mode rpc` JSON-RPC mode
 - [ ] 12.7 Theme system

---

## Architecture Overview

```
sail/
├── package.json              # monorepo root
├── pnpm-workspace.yaml
├── tsconfig.json
├── install.sh                # one-command install script
├── CLAUDE.md
├── SPEC.md
├── IMPLEMENTATION_PLAN.md    # this file
│
└── packages/
    ├── core/                 # @sail/core — Agent + Tools + Memory + Controller
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts         # export mastra instance + agent + controller
    │       ├── agent.ts         # main coding agent (instructions + tools)
    │       ├── controller.ts    # AgentController setup (modes, state, events)
    │       ├── memory.ts        # Memory config (LibSQL + observationalMemory + workingMemory)
    │       ├── observability.ts # Observability config (MastraStorageExporter)
    │       └── tools/
    │           ├── read-file.ts
    │           ├── write-file.ts    # requireApproval: true
    │           ├── edit-file.ts     # requireApproval: true
    │           ├── search.ts
    │           ├── bash.ts          # requireApproval: true
    │           └── list-dir.ts
    │
    ├── cli/                  # @sail/cli — CLI entry point
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── main.ts       # entry: parse args, init controller, start TUI or print mode
    │       ├── args.ts       # argument parsing (commander or yargs)
    │       ├── session.ts    # Session index management (tree structure metadata)
    │       ├── config.ts     # Config loading (env vars + ~/.sail/config.json)
    │       └── commands.ts   # slash command handling (/model, /mode, /tree, etc.)
    │
    └── tui/                  # @sail/tui — Terminal UI
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts      # TUI exports
            ├── renderer.ts   # streaming output renderer (subscribes to controller events)
            └── prompt.ts     # approval prompt UI (triggered by requireApproval events)
```

## Data Flow

```
User types "fix the auth bug"
        │
        ▼
    cli/main.ts
        │ parse args, load config
        ▼
    AgentController
        │ selectOrCreateThread()
        │ switchMode("chat")
        │ sendMessage("fix the auth bug")
        ▼
    Agent.stream()  ←── Memory (observationalMemory compaction)
        │                 ←── Observability (span per tool call)
        │
        ├── text chunk ──► tui/renderer.ts ──► terminal (token-by-token)
        │
        ├── tool call ──► requireApproval?
        │                    │
        │                   YES ──► tui/prompt.ts ──► user Approve/Deny
        │                    │
        │                   NO ──► execute tool ──► return result to agent
        │
        └── done ──► save to Memory thread
```

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Package manager | pnpm workspaces | Mastra recommended, good monorepo support |
| Runtime | Node.js 22+ | Mastra native compatibility, mature ecosystem |
| Language | TypeScript (ESM) | Mastra requires ESM + TypeScript |
| Storage | LibSQL (file) | Mastra `@mastra/libsql` native support, zero-config |
| Default model | google/gemini-pro | Match Pi's default Google provider |
| Agent loop | `Agent.stream()` via `AgentController` | Mastra native streaming + thread/mode/event management |
| Approval | `createTool({ requireApproval: true })` | Mastra built-in — pauses execution until user approves |
| Memory compaction | `observationalMemory: true` | Mastra built-in — auto-compresses old messages |
| Subagents | `agent.agents: {}` | Mastra built-in — agents calling agents |
| Tree sessions | `memory.cloneThread()` | Mastra primitive for branching conversations |
| Logging | Mastra Observability + `MastraStorageExporter` | Structured JSON + OpenTelemetry upgrade path |
