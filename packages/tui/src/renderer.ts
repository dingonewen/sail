import chalk from "chalk";

/** Status line displayed during tool execution */
const TOOL_LABELS: Record<string, string> = {
  mastra_workspace_read_file: "Reading file",
  mastra_workspace_write_file: "Writing file",
  mastra_workspace_edit_file: "Editing file",
  mastra_workspace_grep: "Searching",
  mastra_workspace_execute_command: "Running command",
  mastra_workspace_list_files: "Listing directory",
  mastra_workspace_delete: "Deleting",
  mastra_workspace_mkdir: "Creating directory",
  mastra_workspace_file_stat: "Checking file",
  mastra_workspace_get_process_output: "Getting process output",
  mastra_workspace_kill_process: "Killing process",
};

/** Shorthand name for display */
function shortName(fullName: string): string {
  const prefix = "mastra_workspace_";
  return fullName.startsWith(prefix) ? fullName.slice(prefix.length) : fullName;
}

/**
 * Terminal renderer for streaming agent output.
 * Handles token-by-token text, tool status, and step events.
 */
export class Renderer {
  private lastToolLine = false;

  /** Render a chunk of streamed text to stdout */
  writeChunk(chunk: string): void {
    this.lastToolLine = false;
    process.stdout.write(chunk);
  }

  /** Show a tool call starting */
  showToolCall(name: string, args: unknown): void {
    const label = TOOL_LABELS[name] || shortName(name);
    const details = formatToolArgs(name, args);
    process.stdout.write(chalk.dim(`\n  ⚙ ${label}${details} `));
    this.lastToolLine = true;
  }

  /** Mark the last tool as done */
  showToolResult(_name: string, _result: unknown): void {
    if (this.lastToolLine) {
      process.stdout.write(chalk.dim("✓"));
    }
  }

  /** Show step finish reason (if not normal stop) */
  showStepFinish(finishReason: string, stepCount?: number): void {
    if (finishReason === "stop" || finishReason === "end-turn") return;
    const emoji =
      finishReason === "tool-calls" ? "🔧" :
      finishReason === "length" ? "✂️" :
      finishReason === "error" ? "❌" : "•";
    const msg = stepCount ? `[step ${stepCount}] ${finishReason}` : finishReason;
    process.stdout.write(chalk.dim(`\n  ${emoji} ${msg}`));
  }

  /** Print an error message */
  error(message: string): void {
    process.stderr.write(chalk.red(`\n  Error: ${message}\n`));
  }

  /** Print a separator */
  separator(): void {
    process.stdout.write("\n");
  }
}

/** Extract a short description from tool args for display */
function formatToolArgs(name: string, args: unknown): string {
  if (typeof args !== "object" || args === null) return "";
  const a = args as Record<string, unknown>;

  switch (name) {
    case "mastra_workspace_read_file":
      return a.path ? ` ${a.path}` : "";
    case "mastra_workspace_write_file":
      return a.path ? ` ${a.path}` : "";
    case "mastra_workspace_edit_file":
      return a.path ? ` ${a.path}` : "";
    case "mastra_workspace_list_files":
      return a.path ? ` ${a.path}` : "";
    case "mastra_workspace_execute_command":
      return a.command ? `: ${String(a.command).slice(0, 60)}` : "";
    case "mastra_workspace_grep":
      return a.pattern ? ` "${a.pattern}"` : "";
    default:
      return "";
  }
}
