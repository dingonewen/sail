import chalk from "chalk";

/**
 * Terminal renderer for streaming agent output.
 */
export class Renderer {
  writeChunk(chunk: string): void {
    process.stdout.write(chunk);
  }

  showStepFinish(reason: string): void {
    if (reason !== "stop" && reason !== "end-turn" && reason !== "?") {
      process.stdout.write(chalk.dim(` [${reason}]`));
    }
  }

  error(message: string): void {
    process.stderr.write(chalk.red(`\n  Error: ${message}\n`));
  }
}
