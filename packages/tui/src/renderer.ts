import chalk from "chalk";

/** Status line displayed during tool execution */
const TOOL_STATUS: Record<string, string> = {
  "read-file": "Reading file...",
  "write-file": "Writing file...",
  "edit-file": "Editing file...",
  search: "Searching...",
  bash: "Running command...",
  "list-dir": "Listing directory...",
};

/**
 * Simple terminal renderer for streaming agent output.
 * Handles token-by-token text output, tool status, and formatting.
 */
export class Renderer {
  private lastToolStatus = "";

  /** Render a chunk of streamed text to stdout */
  writeChunk(chunk: string): void {
    process.stdout.write(chunk);
  }

  /** Show a tool execution status line */
  showToolStatus(toolName: string): void {
    const status = TOOL_STATUS[toolName] || `Running ${toolName}...`;
    this.lastToolStatus = chalk.dim(`\n  ${status}`);
    process.stdout.write(this.lastToolStatus);
  }

  /** Clear the tool status line once done */
  clearToolStatus(): void {
    if (this.lastToolStatus) {
      process.stdout.write(chalk.dim(" done.\n"));
      this.lastToolStatus = "";
    }
  }

  /** Print a separator */
  separator(): void {
    process.stdout.write("\n");
  }

  /** Print an informational message */
  info(message: string): void {
    process.stdout.write(chalk.dim(message) + "\n");
  }

  /** Print an error message */
  error(message: string): void {
    process.stderr.write(chalk.red(`Error: ${message}`) + "\n");
  }
}
