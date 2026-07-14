# Sail

<p align="center">
  <em>Terminal coding agent — from-scratch rewrite of <a href="https://pi.dev">Pi</a> on <a href="https://mastra.ai">Mastra</a></em>
</p>

---

```bash
curl -fsSL https://raw.githubusercontent.com/dingonewen/sail/main/install.sh | sh
sail "fix the auth bug"
```

## Architecture

Sail is built on **[Mastra](https://mastra.ai)** as the agent runtime. All core capabilities — agent loop, tools, sandbox, memory, subagents — come from Mastra, not hand-rolled.

```
User → CLI (args, config, sessions)
         → SailController (modes, HITL, observability)
              → Mastra Agent.streamUntilIdle()
                   → Workspace sandbox (LocalSandbox + LocalFilesystem)
                   → Memory (LibSQL)
                   → Subagents (code-reviewer / explorer / fixer)
                        → TUI (streaming markdown → ANSI, spinner, prompts)
```

## Quick Start (from source)

```bash
git clone https://github.com/dingonewen/sail.git
cd sail
pnpm install && pnpm build
node packages/cli/dist/main.js "fix the auth bug"
```

On first run, a setup wizard helps you pick a provider and enter an API key. Switch anytime with `/login`.

> `npm install -g sail` is planned once the package is published to npm.

## Features

### Supervisor + Subagents (L5)

```
Supervisor (Sail)
  ├─ code-reviewer  → read-only, finds bugs & security issues
  ├─ code-explorer → read-only, navigates codebases
  └─ code-fixer    → full tools, implements changes
```

- **LLM routes tasks** by reading each subagent's description — no hard-coded logic
- **Tool-level access control** — reviewer & explorer can't write or run commands
- **Parallel delegation** — `backgroundTasks` + `streamUntilIdle()`
- **Delegation visibility** — spinner + `→ explorer` / `← explorer` inline display
- **Delegation hooks** — `onDelegationStart` / `onDelegationComplete` for quality control

### Memory (L4)

| Processor | What it does |
|---|---|
| **WorkingMemory** | Remembers facts about you across sessions |
| **ObservationalMemory** | Auto-compacts long conversations |
| **SemanticRecall** | Vector search — finds relevant past messages by meaning |

- All three processors enabled
- Compaction uses the same model as the agent (not hardcoded Google)
- Embedder auto-detected from provider (OpenAI → text-embedding-3-small, Google → gemini-embedding-001)
- Disable semantic recall with `SAIL_SEMANTIC_RECALL=false`

### Sandbox (L3)

Code execution runs through Mastra's `Workspace` + `LocalSandbox`:

- **OS-level isolation** — seatbelt (macOS) or bubblewrap (Linux)
- **LocalFilesystem** manages all file operations
- **Dangerous tools require approval** — no silent execution

### Human-in-the-Loop (L7)

```
⚠ execute_command requires approval
  Parameters: { "command": "rm -rf /" }

  [A]llow  [D]eny  [Y]es to all
  Choice:
```

- CLI flags: `--approve` (auto-allow), `--no-approve` (auto-deny)
- `-p` mode auto-approves (no user to prompt)

### Observability

Structured event recording for debugging and auditing:

```bash
SAIL_OBSERVABILITY=console sail "fix the bug"    # inline console output
SAIL_OBSERVABILITY=file sail "fix the bug"       # → ~/.sail/observability.jsonl
```

Records tool calls (name, args, duration), model turns (finish reason, tokens), delegations, and errors. Default off — no TUI noise.

### Multi-Provider

Save multiple providers, switch anytime:

```bash
/login anthropic   # switch to Anthropic
/login deepseek    # add & switch to DeepSeek
/login             # list saved providers
```

### Sessions

Tree-structured — branch from any point:

```
● abc12345  Add login feature         Jul 14
  ├─ def67890  (fork) Use JWT instead  Jul 14
  ├─ ghi11223  (fork) Use OAuth        Jul 14
```

`/tree` to browse, `--resume` to pick one, `--fork <id>` to branch.

### TUI

- **Markdown → ANSI** — headings, bold, code, tables, links, blockquotes in [Catppuccin Latte](https://github.com/catppuccin/catppuccin) colors
- **Braille spinner** — `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` during agent wait
- **Typewriter streaming** — token-by-token output
- **`/` commands** — `/login`, `/model`, `/mode`, `/tree`, `/sessions`, `/clear`, `/exit`

## Full Options

```
Usage: sail [options] [messages...]

Options:
  --provider <name>             Model provider (anthropic, openai, google, deepseek)
  --model <pattern>             Model in "provider/model" format
  --api-key <key>               API key (defaults to provider env var)
  --print, -p                   Non-interactive mode: process and exit
  --continue, -c                Continue the most recent session
  --resume, -r                  Select a session to resume
  --session <id>                Use a specific session
  --fork <id>                   Fork a session into a new branch
  --name, -n <name>             Session display name
  --no-session                  Ephemeral (don't save)
  --tools <tools>               Comma-separated tool allowlist
  --exclude-tools <tools>       Comma-separated tool denylist
  --thinking <level>            off, minimal, low, medium, high, xhigh, max
  --approve, -a                 Auto-approve all dangerous tools
  --no-approve                  Deny all dangerous tools
  --no-context-files            Disable AGENTS.md / CLAUDE.md loading
  --list-models [search]        List available models
  --list-providers              List providers and status
  --help, -h                    Show help
  --version, -v                 Show version
```

## Harness Coverage

| Lesson | Concept | Mastra Primitive | Status |
|---|---|---|---|
| L1 | Agent Loop | `Agent.streamUntilIdle()` | ✅ |
| L2 | Durable Execution | `DurableAgent` | ❌ Post-MVP |
| L3 | Sandboxing | `Workspace` + `LocalSandbox` | ✅ |
| L4 | Memory / Context | Working + Observational + SemanticRecall | ✅ |
| L5 | Router / Handoff | `Agent.agents` + delegation hooks | ✅ |
| L6 | Hierarchical Supervision | `Workflow.parallel()` | ❌ Post-MVP |
| L7 | Human-in-the-Loop | `requireToolApproval` + approval UI | ✅ |

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test          # 26 tests across 3 packages
pnpm test -- --run # CI mode (no watch)
```

Tests run on every push via GitHub Actions (Node 22 + 24, build + typecheck + test).

## Config

Multiple providers coexist in `~/.sail/config.json`:

```json
{
  "defaultProvider": "anthropic",
  "providers": {
    "anthropic": { "model": "anthropic/claude-sonnet-4-6", "apiKey": "sk-ant-..." },
    "deepseek":   { "model": "deepseek/deepseek-chat",    "apiKey": "sk-..." }
  }
}
```

| Env Variable | Description |
|---|---|
| `SAIL_MODEL` | Model in `provider/model` format |
| `SAIL_DB_PATH` | Path to LibSQL database |
| `SAIL_OBSERVABILITY` | `console` or `file` for event recording |
| `SAIL_SEMANTIC_RECALL` | Set `false` to disable vector search |

## License

MIT
