import chalk from "chalk";
import { createInterface } from "node:readline";

const c = {
  peach: chalk.hex("#fe640b"),
  red: chalk.hex("#d20f39"),
  green: chalk.hex("#40a02b"),
  mauve: chalk.hex("#8839ef"),
  subtext0: chalk.hex("#6c6f85"),
};

export type ApprovalResult = "approve" | "deny" | "approve-all";

/**
 * Prompt the user to approve a dangerous tool execution.
 */
export async function promptApproval(
  toolName: string,
  params: Record<string, unknown>
): Promise<ApprovalResult> {
  console.log();
  console.log(
    c.peach.bold("⚠") + " " +
    c.mauve.bold(toolName) + " " +
    c.subtext0("requires approval")
  );
  console.log(c.subtext0("  Parameters:"), JSON.stringify(params, null, 2));
  console.log();
  console.log(
    c.green("  [A]llow") + "  " +
    c.red("[D]eny") + "  " +
    c.peach("[Y]es to all")
  );

  const answer = await ask("  Choice: ");
  const a = answer.trim().toLowerCase();
  if (a === "y" || a === "yes") return "approve-all";
  if (a === "a" || a === "allow") return "approve";
  return "deny";
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false, // don't emit 'keypress' on stdin — avoids double-input
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
