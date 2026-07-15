# Code Exploration
Description: How to explore unfamiliar codebases systematically. Load when tracing dependencies, understanding architecture, or answering "how does X work".

## Strategy

### 1. Start Broad
- List the project root: `list_files`
- Check package.json for dependencies and scripts
- Read CLAUDE.md or README.md if present

### 2. Trace the Entry Point
- Find the main entry (index.ts, main.ts, app.ts)
- Read it — don't assume, verify
- Follow imports one level at a time

### 3. Search for Patterns
- Use `grep` for function names, class names, type references
- Use `search` for fuzzy queries about architecture
- Use `lsp_inspect` for go-to-definition and type info

### 4. Build a Mental Model
- What are the layers? (CLI → Controller → Agent → Tools)
- What are the data flow paths? (Input → Transform → Output)
- What are the side effects? (DB writes, API calls, file I/O)

## Output Format

Always provide:
- **Files involved** — paths and their roles
- **How they connect** — dependencies and call chains
- **Key functions** — what they do and why they exist
- **Uncertainties** — flag anything you're not sure about

Do not guess. If something is unclear, say so and suggest what to read next.
