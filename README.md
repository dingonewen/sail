# Sail

<p align="center">
  <em>AI coding assistant with read, bash, edit, write tools.</em>
</p>

<p align="center">
  <a href="https://discord.gg/example"><img src="https://img.shields.io/badge/Discord-join-blue?logo=discord" alt="Discord"></a>
  <a href="https://www.npmjs.com/package/sail"><img src="https://img.shields.io/npm/v/sail" alt="npm"></a>
</p>

---

Sail is a terminal coding agent — ask it to fix bugs, refactor code, or explore a codebase, and it reads, writes, edits, and runs commands to get the job done. It is a from-scratch rewrite of [Pi](https://pi.dev) using [Mastra](https://mastra.ai) as the agent runtime library.

## Packages

| Package | Description |
|---|---|
| [`@sail/core`](./packages/core) | Agent, tools, memory, and observability — powered by Mastra |
| [`@sail/cli`](./packages/cli) | CLI entry point, argument parsing, and session management |
| [`@sail/tui`](./packages/tui) | Terminal UI — streaming renderer and approval prompts |

## Quick Start

```bash
# Install
npm install -g sail

# Set your API key
export ANTHROPIC_API_KEY=your-key-here

# Start coding
sail "fix the auth bug in login.ts"
```

Or install via curl:

```bash
curl -fsSL https://raw.githubusercontent.com/dingonewen/sail/main/install.sh | sh
```

## Usage

```bash
# Interactive mode
sail

# With an initial prompt
sail "refactor the database layer to use connection pooling"

# Non-interactive (print and exit)
sail -p "list all TypeScript files in src/"

# Continue your last session
sail --continue "what did we change last time?"

# Fork a previous session
sail --fork <session-id> "try a different approach"

# Use a specific model
sail --model openai/gpt-5.5 "explain this code"

# Disable session persistence
sail --no-session "one-off question"
```

### Full Options

```
Usage: sail [options] [messages...]

Options:
  --provider <name>              Model provider (anthropic, openai, google)
  --model <pattern>              Model ID in "provider/model" format
  --api-key <key>                API key (defaults to provider env var)
  --print, -p                    Non-interactive mode: process prompt and exit
  --continue, -c                 Continue the most recent session
  --resume, -r                   Select a session to resume from a list
  --session <id>                 Use a specific session
  --fork <id>                    Fork a session into a new branch
  --name, -n <name>              Set a display name for the session
  --no-session                   Don't save session (ephemeral)
  --tools <tools>                Comma-separated allowlist of tools
  --exclude-tools <tools>        Comma-separated denylist of tools
  --thinking <level>             Thinking level: off, minimal, low, medium, high, xhigh, max
  --no-context-files, -nc        Disable AGENTS.md / CLAUDE.md loading
  --approve, -a                  Auto-approve all dangerous tools
  --mode <mode>                  Output mode: text (default) or json
  --list-models [search]         List available models
  --help, -h                     Show help
  --version, -v                  Show version
```

## Tools

Sail uses Mastra's Workspace tools (via `createWorkspaceTools()`), not hand-rolled:

| Tool | Description | Requires Approval |
|---|---|---|
| `mastra_workspace_read_file` | Read file contents | No |
| `mastra_workspace_write_file` | Create or overwrite a file | **Yes** |
| `mastra_workspace_edit_file` | String replacement edit | **Yes** |
| `mastra_workspace_grep` | Regex search across files | No |
| `mastra_workspace_execute_command` | Execute shell command (sandboxed) | **Yes** |
| `mastra_workspace_list_files` | List directory contents | No |

Additional tools: `delete`, `mkdir`, `file_stat`, `ast_edit`, `search`.

## Configuration

Sail supports multiple providers simultaneously. Configuration lives in `~/.sail/config.json`:

```json
{
  "defaultProvider": "anthropic",
  "providers": {
    "anthropic": {
      "model": "anthropic/claude-sonnet-4-6",
      "apiKey": "sk-ant-..."
    },
    "deepseek": {
      "model": "deepseek/deepseek-chat",
      "apiKey": "sk-..."
    }
  }
}
```

Switch providers at runtime with `/login anthropic` or `/login deepseek`.

| Variable | Description |
|---|---|
| `SAIL_MODEL` | Model in `provider/model` format |
| `SAIL_DB_PATH` | Path to the LibSQL database file |
| `SAIL_SEMANTIC_RECALL` | Set to `false` to disable semantic search |

## Project Context

Sail automatically discovers and loads these files (walking up from the current directory):

- `AGENTS.md` / `CLAUDE.md` — project instructions loaded into the context
- `SYSTEM.md` — replaces or appends to the system prompt

Global instructions can be placed in `~/.sail/agent/*.md`.

Disable with `--no-context-files`.

## Sessions

Sessions are stored as a tree — you can branch from any point:

```
● abc12345  Add login feature         Jan 1
  ├─ def67890  (fork) Use JWT instead  Jan 2
  ├─ ghi11223  (fork) Use OAuth        Jan 2
● jkl33445  Refactor database          Jan 3
```

Use `/tree` in interactive mode to see your session tree, `--resume` to pick one, and `--fork <id>` to branch.

## Memory

Sail uses Mastra's `Memory` with all four processors:

| Feature | Description | Status |
|---|---|---|
| **Working Memory** | Cross-session user context — remembers facts about you | ✅ Enabled |
| **Observational Memory** | Auto-compacts long conversations to stay within context limits | ✅ Enabled |
| **Semantic Recall** | Vector search across history — finds relevant past messages by meaning | ✅ Enabled (auto-detects embedder) |
| **Memory Processors** | Custom message filter/transform pipeline | Post-MVP |

## Sandbox

Code execution runs through Mastra's `Workspace` + `LocalSandbox`:

- **OS-level isolation** via seatbelt (macOS) or bubblewrap (Linux)
- **Filesystem sandbox** — `LocalFilesystem` manages all file operations
- **Network control** — configurable network access for sandboxed commands
- **Timeout & env isolation** — no accidental secret exposure

## Harness / Course Coverage

How Sail maps to the agent engineering course curriculum:

| Lesson | Concept | Mastra Primitive | Status |
|---|---|---|---|
| L1 | Agent Loop | `Agent.stream()` / `Agent.generate()` | ✅ Implemented |
| L2 | Durable Execution | `DurableAgent`, Inngest/Temporal runners | ❌ Post-MVP |
| L3 | Sandboxing | `Workspace` + `LocalSandbox` + `createWorkspaceTools()` | ✅ Implemented |
| L4 | Memory / Context | `ObservationalMemory` + `WorkingMemory` + `SemanticRecall` | ✅ Implemented |
| L5 | Router / Handoff | `SupervisorAgent` + `.network()` + A2A/ACP | ❌ Post-MVP |
| L6 | Hierarchical Supervision | `Workflow.parallel()` / `.foreach()` + Supervisor | ❌ Post-MVP |
| L7 | Human-in-the-Loop | `requireApproval` on dangerous tools | ⚠️ Config done, TUI pending |

**MVP scope:** L1, L3, L4, L7 (approval config) are complete. L2, L5, L6 are architectural features available in Mastra but not yet wired in Sail — planned post-MVP.

## Permissions

Dangerous tools (`execute_command`, `write_file`, `edit_file`, `delete`) require user approval. Sail uses Mastra's `requireApproval` on workspace tools.

For fully unattended runs, use `--approve` to auto-approve all tools. Use with caution.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Type-check
pnpm typecheck

# Run from source
node packages/cli/dist/main.js "hello"
```

## Contributing

Contributions welcome. Read `CLAUDE.md` for project rules and architecture notes.

## License

MIT
