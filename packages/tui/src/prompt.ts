import chalk from "chalk";
import { createInterface } from "node:readline";

/**
 * Prompt the user to approve a dangerous tool execution.
 * Returns true if approved, false if denied.
 */
export async function promptApproval(
  toolName: string,
  params: Record<string, unknown>
): Promise<boolean> {
  console.log();
  console.log(
    chalk.yellow.bold("⚠") +
      " " +
      chalk.bold(toolName) +
      " " +
      chalk.dim("requires approval")
  );
  console.log(chalk.dim("  Parameters:"), JSON.stringify(params, null, 2));
  console.log();
  console.log(
    chalk.green("  [A]llow") +
      "  " +
      chalk.red("[D]eny") +
      "  " +
      chalk.yellow("[Y]es to all")
  );

  const answer = await ask("  Choice: ");
  const lower = answer.trim().toLowerCase();

  if (lower === "a" || lower === "y" || lower === "yes") {
    return true;
  }
  return false;
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
