#!/usr/bin/env node

import { parseArgs } from "./args.js";
import { loadConfig } from "./config.js";
import {
  createSession,
  getLastSession,
  getSession,
  forkSession,
  listSessions,
  touchSession,
} from "./session.js";
import { SailController } from "@sail/core";
import type { AgentMode } from "@sail/core";
import { loadContextFiles } from "./context.js";
import chalk from "chalk";

const program = parseArgs(process.argv);
const options = program.opts();
const messages = program.args;

async function main() {
  // --list-models
  if (options.listModels !== undefined) {
    console.log(
      chalk.yellow(
        "Model listing requires network access. Set SAIL_MODEL env var to configure the model."
      )
    );
    console.log(
      "Supported format: provider/model (e.g., anthropic/claude-sonnet-4-6, openai/gpt-5.5, google/gemini-pro)"
    );
    console.log(
      "Provider env vars: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY"
    );
    process.exit(0);
  }

  // Load config
  const config = loadConfig();

  // Apply model override from CLI
  if (options.model) {
    process.env.SAIL_MODEL = options.model;
  }

  const controller = new SailController();

  // Load context files unless disabled
  let contextPrefix = "";
  if (!options.noContextFiles) {
    const { agentsMd, systemPrompt } = loadContextFiles(process.cwd());
    if (agentsMd.length > 0) {
      contextPrefix =
        "<project-context>\n" + agentsMd.join("\n\n") + "\n</project-context>\n\n";
    }
    if (systemPrompt) {
      // Append to the system prompt via env
      process.env.SAIL_APPEND_SYSTEM = systemPrompt;
    }
  }

  // ---- Non-interactive mode (-p) ----
  if (options.print) {
    const prompt = messages.join(" ") || "Hello";
    const fullPrompt = contextPrefix + prompt;
    console.log(chalk.dim("Thinking..."));

    try {
      const response = await controller.generate(fullPrompt, {
        resource: "default-user",
        thread: (options.session === false)
          ? undefined
          : createSession(options.name).threadId,
        maxSteps: 10,
      });

      console.log(response.text);
    } catch (error) {
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    }
    process.exit(0);
  }

  // ---- Interactive mode ----
  const prompt = messages.join(" ");

  // Determine session
  let session;
  if (options.fork) {
    session = forkSession(options.fork, options.name);
    if (!session) {
      console.error(chalk.red(`Session not found: ${options.fork}`));
      process.exit(1);
    }
  } else if (options.resume) {
    console.log(chalk.dim("Recent sessions:"));
    const sessions = listSessions().slice(0, 10);
    for (const s of sessions) {
      console.log(
        `  ${chalk.cyan(s.id.slice(0, 8))}  ${s.name}  ${chalk.dim(new Date(s.updatedAt).toLocaleString())}`
      );
    }
    console.log(
      chalk.dim("\nUse --session <id> to resume a specific session")
    );
    process.exit(0);
  } else if (options.continue) {
    session = getLastSession();
    if (!session) {
      console.log(
        chalk.yellow("No previous session found. Starting a new one.")
      );
      session = createSession(options.name);
    } else {
      console.log(chalk.dim(`Continuing session: ${session.name}`));
    }
  } else if (options.session) {
    session = getSession(options.session);
    if (!session) {
      session = createSession(options.name);
    }
  } else {
    session = (options.session === false) ? null : createSession(options.name);
  }

  // Enter the interactive TUI loop
  if (prompt) {
    console.log(chalk.bold("Sail"), chalk.dim("·"), prompt);
    console.log();

    try {
      const initialPrompt = contextPrefix + prompt;
      await controller.stream(initialPrompt, {
        resource: "default-user",
        thread: session?.threadId,
        onTextChunk: (chunk) => {
          process.stdout.write(chunk);
        },
        onError: (error) => {
          console.error(chalk.red(`\n  Error: ${error.message}`));
        },
      });

      console.log();
      if (session) touchSession(session.id);
    } catch (error) {
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    }
  } else {
    // No initial prompt — interactive readline loop
    console.log(
      chalk.bold("Sail"),
      chalk.dim(`v${program.version()}`)
    );
    console.log(chalk.dim("Type a message to start, or /help for commands."));
    console.log(
      chalk.dim(
        `Session: ${session?.name || "ephemeral"}  ·  Model: ${options.model || config.model || "default"}`
      )
    );
    console.log();

    // Readline loop
    const readline = await import("node:readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.green("> "),
    });

    rl.prompt();

    for await (const line of rl) {
      const input = line.trim();
      if (!input) {
        rl.prompt();
        continue;
      }

      // Handle slash commands
      if (input.startsWith("/")) {
        handleSlashCommand(input, controller, session);
        rl.prompt();
        continue;
      }

      try {
        console.log();
        await controller.stream(input, {
          resource: "default-user",
          thread: session?.threadId,
          onTextChunk: (chunk) => {
            process.stdout.write(chunk);
          },
          onError: (error) => {
            console.error(chalk.red(`\n  Error: ${error.message}`));
          },
        });
        console.log();
        if (session) touchSession(session.id);
      } catch (error) {
        console.error(chalk.red("Error:"), error);
      }
      rl.prompt();
    }
  }

  console.log();
  if (session) {
    touchSession(session.id);
  }
}

function handleSlashCommand(
  input: string,
  controller: SailController,
  session: ReturnType<typeof createSession> | null
) {
  const [cmd, ...args] = input.slice(1).split(/\s+/);

  switch (cmd) {
    case "help":
      console.log(chalk.bold("\nCommands:"));
      console.log("  /help        Show this help");
      console.log("  /model       Show or change the current model");
      console.log(
        "  /mode        Show or change the agent mode (chat, plan, build)"
      );
      console.log("  /tree        Show the session tree");
      console.log("  /sessions    List recent sessions");
      console.log("  /clear       Clear the screen");
      console.log("  /exit        Exit Sail\n");
      break;

    case "model":
      console.log(
        chalk.dim(`Current model: ${process.env.SAIL_MODEL || "default"}`)
      );
      if (args[0]) {
        process.env.SAIL_MODEL = args[0];
        console.log(chalk.green(`Model changed to: ${args[0]}`));
      }
      break;

    case "mode":
      console.log(
        chalk.dim(`Current mode: ${controller.mode}`)
      );
      console.log(chalk.dim("Modes: chat (default), plan, build"));
      if (args[0]) {
        controller.switchMode(args[0] as AgentMode);
        console.log(chalk.green(`Switched to mode: ${args[0]}`));
      }
      break;

    case "tree":
      console.log(chalk.bold("\nSession tree:"));
      const sessions = listSessions();
      for (const s of sessions.slice(0, 20)) {
        const prefix = s.parentId ? "  ├─" : "●";
        const marker =
          s.id === session?.id ? chalk.green(" (current)") : "";
        console.log(
          `  ${prefix} ${chalk.cyan(s.id.slice(0, 8))}  ${s.name}${marker}  ${chalk.dim(new Date(s.updatedAt).toLocaleString())}`
        );
      }
      console.log();
      break;

    case "sessions":
      console.log(chalk.bold("\nRecent sessions:"));
      for (const s of listSessions().slice(0, 10)) {
        const marker = s.id === session?.id ? chalk.green(" *") : " ";
        console.log(
          `${marker} ${chalk.cyan(s.id.slice(0, 8))}  ${s.name}  ${chalk.dim(new Date(s.updatedAt).toLocaleString())}`
        );
      }
      console.log();
      break;

    case "clear":
      process.stdout.write("\x1b[2J\x1b[0f");
      break;

    case "exit":
      console.log(chalk.dim("Goodbye!"));
      process.exit(0);

    default:
      console.log(
        chalk.yellow(
          `Unknown command: /${cmd}. Type /help for available commands.`
        )
      );
  }
}

main().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});
