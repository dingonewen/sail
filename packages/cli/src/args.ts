import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface PackageJson {
  version: string;
  description: string;
}

let version = "0.1.0";
try {
  const pkgPath = resolve(import.meta.dirname, "..", "package.json");
  const pkg: PackageJson = JSON.parse(readFileSync(pkgPath, "utf-8"));
  version = pkg.version;
} catch {
  // Use default version
}

export function parseArgs(argv: string[]) {
  const program = new Command();

  program
    .name("sail")
    .description("AI coding assistant with read, bash, edit, write tools")
    .version(version)
    .argument(
      "[messages...]",
      "Initial prompt or messages to send to the agent"
    )
    .option("--provider <name>", "Model provider name (e.g., anthropic, openai, google)")
    .option(
      "--model <pattern>",
      'Model pattern or ID in "provider/model" format'
    )
    .option("--api-key <key>", "API key (defaults to provider env var)")
    .option(
      "--system-prompt <text>",
      "Override the system prompt"
    )
    .option(
      "--append-system-prompt <text>",
      "Append text to the system prompt (can be used multiple times)",
      (val, prev: string[]) => [...prev, val],
      [] as string[]
    )
    .option("--print, -p", "Non-interactive mode: process prompt and exit")
    .option(
      "--mode <mode>",
      "Output mode: text (default)",
      "text"
    )
    .option("--continue, -c", "Continue the most recent session")
    .option("--resume, -r", "Select a session to resume from a list")
    .option(
      "--session <path|id>",
      "Use a specific session file or partial UUID"
    )
    .option(
      "--session-id <id>",
      "Use an exact project session ID, creating it if missing"
    )
    .option(
      "--fork <path|id>",
      "Fork a specific session into a new session"
    )
    .option(
      "--session-dir <dir>",
      "Directory for session storage"
    )
    .option("--no-session", "Don't save session (ephemeral)")
    .option("--name, -n <name>", "Set a display name for the session")
    .option(
      "--tools <tools>",
      "Comma-separated allowlist of tool names to enable"
    )
    .option(
      "--exclude-tools <tools>",
      "Comma-separated denylist of tool names to disable"
    )
    .option(
      "--thinking <level>",
      "Set thinking level: off, minimal, low, medium, high, xhigh, max"
    )
    .option(
      "--no-context-files",
      "Disable AGENTS.md and CLAUDE.md discovery and loading"
    )
    .option("--approve, -a", "Auto-approve all dangerous tool calls for this run")
    .option(
      "--no-approve",
      "Deny all dangerous tool calls for this run"
    )
    .option("--list-models [search]", "List available models (with optional search)")
    .option("--list-providers", "List supported AI providers and their status")
    .option("--verbose", "Force verbose startup output")
    .option("--offline", "Disable startup network operations");

  program.parse(argv);
  return program;
}
