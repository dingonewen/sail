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
              → Mastra Agent.stream({ untilIdle: true })
                   → Workspace (LocalSandbox, LocalFilesystem, BM25, Skills)
                   → Memory (LibSQL — working, observational, semantic recall)
                   → Subagents (code-reviewer / explorer / fixer)
                   → TUI (streaming markdown → ANSI, spinner, prompts)
```

## Quick Start (from source)

```bash
git clone https://github.com/dingonewen/sail.git
cd sail
pnpm install && pnpm build
node packages/cli/dist/main.js
```

On first run, a setup wizard prompts you to pick a provider and enter an API key. Type a message to start coding, or pass a prompt as an argument:

```bash
node packages/cli/dist/main.js "explain the auth module"
```

Switch provider anytime with `/login`.

> `npm install -g sail` is planned once the package is published to npm.

## Features

### Supervisor + Subagents

```
Supervisor (Sail)
  ├─ code-reviewer  → read-only, finds bugs & security issues
  ├─ code-explorer → read-only, navigates codebases
  └─ code-fixer    → full tools, implements changes
```

- **LLM routes tasks** by reading each subagent's description — no hard-coded logic
- **Tool-level access control** — reviewer & explorer physically can't write or run commands (only read-only tools injected)
- **Parallel delegation** — `backgroundTasks` enables concurrent subagent execution
- **Delegation visibility** — inline `→ reviewer` / `← reviewer` display in the TUI

### Skills (on-demand instructions)

Long-form agent instructions extracted from system prompts into lazy-loaded `SKILL.md` files. Supervisor prompt went from ~30 lines to ~11 (saving ~400 tokens/turn). Skills load via Mastra's auto-generated `skill`/`skill_search`/`skill_read` tools.

```
~/.sail/skills/
  orchestration/SKILL.md   — delegation rules & routing logic
  code-review/SKILL.md      — review checklist & severity format
  code-exploration/SKILL.md — search strategy & architecture tracing
  code-fixing/SKILL.md      — edit workflow & verification steps
```

Users can add custom skills by dropping SKILL.md files into the directory. Override with `SAIL_SKILLS_DIR`.

### Workspace Tools

Sail auto-generates tools from Mastra's workspace — filesystem, sandbox, search, and skills. Custom tools can be added with Mastra's `createTool()`:

| Source | Tools |
|--------|-------|
| Workspace — Filesystem | `read_file`, `write_file`, `edit_file`, `list_files`, `delete`, `file_stat`, `mkdir`, `grep` |
| Workspace — Sandbox | `execute_command`, `get_process_output` |
| Workspace — Search | `search` (BM25 full-text) |
| Workspace — Skills | `skill`, `skill_read`, `skill_search` |
| Custom | `web_fetch` — fetches URLs as plain text |

- **BM25 search** — relevance-ranked code search, faster and smarter than grep
- **Read-only tools** shared with reviewer & explorer subagents
- **Dangerous tools** (write, edit, delete, execute) require user approval

### Memory

| Processor | What it does |
|---|---|
| **WorkingMemory** | Remembers facts about you across sessions |
| **ObservationalMemory** | Auto-compacts long conversations |
| **SemanticRecall** | Vector search — finds relevant past messages by meaning |

- All three processors enabled
- Compaction uses the same model as the agent
- Embedder auto-detected from provider (OpenAI → text-embedding-3-small, Google → gemini-embedding-001)
- Disable semantic recall with `SAIL_SEMANTIC_RECALL=false`

### Human-in-the-Loop

```
⚠ execute_command requires approval
  Parameters: { "command": "rm -rf /" }

  [A]llow  [D]eny  [Y]es to all
  Choice:
```

- `[A]` approve one call, `[D]` deny, `[Y]` approve all for the rest of the session
- CLI flags: `--approve` (auto-allow), `--no-approve` (auto-deny)
- `-p` mode auto-approves (no user to prompt)

### Observability

Three-tier observability: local console/file for development, OTLP export for cloud visualization.

```bash
# Local (console or JSONL file)
SAIL_OBSERVABILITY=console sail "fix the bug"
SAIL_OBSERVABILITY=file sail "fix the bug"       # → ~/.sail/observability.jsonl

# Cloud (Logfire, LangSmith, Jaeger — any OTLP-compatible backend)
SAIL_OTLP_ENDPOINT=https://logfire-api.pydantic.dev/v1/traces \
SAIL_OTLP_HEADERS="Authorization=Bearer pk-xxx" \
sail "fix the bug"
```

Or configure once in-session:

```
/obs logfire setup pk-your-api-key        # save to ~/.sail/config.json
/obs logfire on                           # enable
/obs on / /obs off / /obs view 20         # local controls
```

Records every model turn (prompt, response, tokens, finish reason), tool call (name, full args, full result), delegation, and error — with proper traceId/spanId/parentSpanId for waterfall visualization.

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

`/sessions` to list, `/sessions <n>` to switch, `/rename <name>`, `/tree` to browse, `--resume` to pick one, `--fork <id>` to branch.

### TUI

- **Markdown → ANSI** — headings, bold, code, tables, links, blockquotes in [Catppuccin Latte](https://github.com/catppuccin/catppuccin) colors
- **Braille spinner** — `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` during agent think
- **Typewriter streaming** — token-by-token output
- **`/` commands** — `/login`, `/model`, `/mode`, `/tree`, `/sessions`, `/rename`, `/obs`, `/clear`, `/exit`

## Full Options

```
Usage: sail [options] [messages...]

Options:
  --provider <name>             Model provider (anthropic, openai, google, deepseek)
  --model <pattern>             Model in "provider/model" format
  --api-key <key>               API key (defaults to provider env var)
  --print, -p                   Non-interactive mode: process and exit
  --continue, -c                Continue the most recent session
  --resume, -r                  List recent sessions
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
  --obs <mode>                  Observability mode: off, console, file, both
  --list-models [search]        List available models
  --list-providers              List providers and status
  --help, -h                    Show help
  --version, -v                 Show version
```

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test          # 23 tests across 3 packages
```

## Config

Multiple providers coexist in `~/.sail/config.json`:

```json
{
  "defaultProvider": "anthropic",
  "providers": {
    "anthropic": { "model": "anthropic/claude-sonnet-4-6", "apiKey": "sk-ant-..." },
    "deepseek":   { "model": "deepseek/deepseek-chat",    "apiKey": "sk-..." }
  },
  "otlp": {
    "endpoint": "https://logfire-api.pydantic.dev/v1/traces",
    "apiKey": "pk-..."
  }
}
```

| Env Variable | Description |
|---|---|
| `SAIL_MODEL` | Model in `provider/model` format |
| `SAIL_DB_PATH` | Path to LibSQL database |
| `SAIL_OBSERVABILITY` | `off` / `console` / `file` / `both` |
| `SAIL_OTLP_ENDPOINT` | OTLP-compatible trace collector URL |
| `SAIL_OTLP_HEADERS` | Comma-separated `Key=Value` pairs for OTLP auth |
| `SAIL_SEMANTIC_RECALL` | Set `false` to disable vector search |
| `SAIL_SKILLS_DIR` | Custom skills directory path |

## License

MIT
