#!/usr/bin/env node

import { parseArgs } from "./args.js";
import { loadConfig, resolveProvider, setDefaultProvider, getProviderConfig } from "./config.js";
import {
  createSession,
  getLastSession,
  getSession,
  forkSession,
  listSessions,
  touchSession,
  renameSession,
} from "./session.js";
import { SailController, setObservabilityMode, getObservabilityMode, getObservabilityLogPath, flushObservability } from "@sail/core";
import type { AgentMode } from "@sail/core";
import { loadContextFiles } from "./context.js";
import {
  isConfigured,
  isProviderConfigured,
  runSetup,
  listProviders,
  applyProvider,
  getProvider,
} from "./setup.js";
import { Renderer, promptApproval } from "@sail/tui";
import chalk from "chalk";

// Catppuccin Latte
const c = {
  peach: chalk.hex("#fe640b"),
  red: chalk.hex("#d20f39"),
  green: chalk.hex("#40a02b"),
  blue: chalk.hex("#1e66f5"),
  sky: chalk.hex("#04a5e5"),
  mauve: chalk.hex("#8839ef"),
  pink: chalk.hex("#ea76cb"),
  teal: chalk.hex("#179299"),
  lavender: chalk.hex("#7287fd"),
  text: chalk.hex("#4c4f69"),
  subtext0: chalk.hex("#6c6f85"),
  subtext1: chalk.hex("#5c5f77"),
};

const program = parseArgs(process.argv);
const options = program.opts();
const messages = program.args;

async function main() {
  // --list-models
  if (options.listModels !== undefined) {
    console.log(
      c.peach(
        "Model listing requires network access. Set SAIL_MODEL env var to configure the model."
      )
    );
    console.log(
      "Supported format: provider/model (e.g., anthropic/claude-sonnet-4-6, openai/gpt-5.5, google/gemini-pro)"
    );
    console.log(
      "Provider env vars: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, DEEPSEEK_API_KEY"
    );
    await flushObservability();
    process.exit(0);
  }

  // Load config
  const config = loadConfig();

  // --list-providers
  if (options.listProviders) {
    listProviders();
    await flushObservability();
    process.exit(0);
  }

  // Resolve provider: CLI flag > model string > config default
  let providerId = resolveProvider(options.provider, options.model);

  // Apply provider env vars for the agent
  if (providerId) {
    try {
      applyProvider(providerId, options.model, options.apiKey);
    } catch {
      console.log(c.peach(`Unknown provider: ${providerId}`));
      providerId = undefined;
    }
  }

  // First-run setup wizard (interactive mode only)
  if (!options.print) {
    if (providerId && !isProviderConfigured(providerId)) {
      await runSetup(providerId);
    } else if (!providerId && !isConfigured()) {
      await runSetup();
    }
  }

  const controller = new SailController();

  // Wire approval flags
  if (options.approve) controller.setAutoApprove(true);
  if (options.noApprove) controller.setAutoDeny(true);

  // Wire observability flag
  if (options.obs) {
    process.env.SAIL_OBSERVABILITY = options.obs;
  }

  // Load context files unless disabled
  let contextPrefix = "";
  if (!options.noContextFiles) {
    const { agentsMd, systemPrompt } = loadContextFiles(process.cwd());
    if (agentsMd.length > 0) {
      contextPrefix =
        "<project-context>\n" + agentsMd.join("\n\n") + "\n</project-context>\n\n";
    }
    if (systemPrompt) {
      process.env.SAIL_APPEND_SYSTEM = systemPrompt;
    }
  }

  // ---- Non-interactive mode (-p) ----
  if (options.print) {
    // Auto-approve in non-interactive mode (no user to prompt)
    controller.setAutoApprove(true);
    const prompt = messages.join(" ") || "Hello";
    const fullPrompt = contextPrefix + prompt;
    console.log(c.subtext0("Thinking..."));

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
      console.error(c.red("Error:"), error);
      process.exit(1);
    }
    await flushObservability();
    process.exit(0);
  }

  // ---- Interactive mode ----
  const prompt = messages.join(" ");

  // Determine session
  let session: ReturnType<typeof createSession> | null = null;
  if (options.fork) {
    session = forkSession(options.fork, options.name);
    if (!session) {
      console.error(c.red(`Session not found: ${options.fork}`));
      process.exit(1);
    }
  } else if (options.resume) {
    console.log(c.subtext0("Recent sessions:"));
    const sessions = listSessions().slice(0, 10);
    for (const s of sessions) {
      console.log(
        `  ${c.sky(s.id.slice(0, 8))}  ${s.name}  ${c.subtext0(new Date(s.updatedAt).toLocaleString())}`
      );
    }
    console.log(
      c.subtext0("\nUse --session <id> to resume a specific session")
    );
    await flushObservability();
    process.exit(0);
  } else if (options.continue) {
    session = getLastSession();
    if (!session) {
      console.log(
        c.peach("No previous session found. Starting a new one.")
      );
      session = createSession(options.name);
    } else {
      console.log(c.subtext0(`Continuing session: ${session.name}`));
    }
  } else if (options.session) {
    session = getSession(options.session);
    if (!session) {
      session = createSession(options.name);
    }
  } else {
    session = (options.session === false) ? null : createSession(options.name);
  }

  // Re-read config after possible setup wizard
  const currentConfig = loadConfig();
  const activeProvider = currentConfig.defaultProvider || "none";
  const activeModel = currentConfig.providers[activeProvider]?.model || "default";

  const renderer = new Renderer();

  function streamOpts() {
    return {
      onTextChunk: (chunk: string) => renderer.writeChunk(chunk),
      onApprovalRequired: async (tool: { name: string; args: unknown }) => {
        renderer.stopSpinner?.(); // stop spinner during approval prompt
        const result = await promptApproval(tool.name, tool.args as Record<string, unknown>);
        renderer.startSpinner();
        return result;
      },
      onDelegationStart: (agent: string, prompt: string) =>
        renderer.showDelegationStart(agent, prompt),
      onDelegationComplete: (agent: string, preview: string) =>
        renderer.showDelegationComplete(agent, preview),
      onStepFinish: (reason: string) => renderer.showStepFinish(reason),
      onFinish: () => { renderer.flush(); renderer.stopSpinner?.(); },
      onError: (error: Error) => { renderer.error(error.message); renderer.stopSpinner?.(); },
    };
  }

  // Enter the interactive TUI loop
  if (prompt) {
    console.log(c.text.bold("Sail"), c.subtext0("·"), prompt);
    console.log();

    try {
      const initialPrompt = contextPrefix + prompt;
      renderer.startSpinner();
      await controller.stream(initialPrompt, {
        resource: "default-user",
        thread: session?.threadId,
        ...streamOpts(),
      });

      console.log();
      if (session) touchSession(session.id);
    } catch (error) {
      console.error(c.red("Error:"), error);
      process.exit(1);
    }
  } else {
    // No initial prompt — interactive readline loop
    const statusLine = () =>
      c.subtext0(
        `Session: ${session?.name || "ephemeral"}  ·  Provider: ${activeProvider}  ·  Model: ${activeModel}`
      );

    console.log(
      c.text.bold("Sail"),
      c.subtext0(`v${program.version()}`)
    );
    console.log(c.subtext0("Type a message to start, or /help for commands."));
    console.log(statusLine());
    console.log();

    const readline = await import("node:readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: c.green("> "),
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
        const newSession = await handleSlashCommand(input, controller);
        if (newSession !== undefined) {
          session = newSession;
          console.log(statusLine());
        }
        rl.prompt();
        continue;
      }

      try {
        console.log();
        renderer.startSpinner();
        await controller.stream(input, {
          resource: "default-user",
          thread: session?.threadId,
          ...streamOpts(),
        });
        console.log();
        if (session) touchSession(session.id);
      } catch (error) {
        console.error(c.red("Error:"), error);
      }
      rl.prompt();
    }
  }

  console.log();
  if (session) {
    touchSession(session.id);
  }

  // ── slash-command handler ──
  async function handleSlashCommand(
    input: string,
    controller: SailController,
  ): Promise<ReturnType<typeof createSession> | null | undefined> {
    const [cmd, ...args] = input.slice(1).split(/\s+/);

    switch (cmd) {
      case "help":
        console.log(c.text.bold("\nCommands:"));
        console.log("  /help        Show this help");
        console.log("  /login       Switch provider or add a new one");
        console.log("  /model       Show or change the current model");
        console.log("  /mode        Show or change the agent mode (chat, plan, build)");
        console.log("  /obs         Show or set observability mode (off, console, file, both)");
        console.log("  /tree        Show the session tree");
        console.log("  /sessions    List or switch sessions (/sessions <number>)");
        console.log("  /rename      Rename the current session");
        console.log("  /clear       Clear the screen");
        console.log("  /exit        Exit Sail\n");
        break;

      case "obs": {
        if (!args[0]) {
          // /obs — show current mode
          const mode = getObservabilityMode();
          console.log(c.subtext0(`Observability: ${c.green(mode)}`));
          if (mode === "file" || mode === "both") {
            console.log(c.subtext0(`Log: ${getObservabilityLogPath()}`));
          }
        } else if (args[0] === "view") {
          // /obs view [N] — tail the JSONL log
          const n = parseInt(args[1]) || 20;
          const path = getObservabilityLogPath();
          try {
            const { readFileSync, existsSync } = await import("node:fs");
            if (!existsSync(path)) {
              console.log(c.peach("No observability log found. Set mode to file or both first."));
            } else {
              const lines = readFileSync(path, "utf-8").trim().split("\n");
              const tail = lines.slice(-n);
              console.log(c.subtext0(`\nLast ${tail.length} events:`));
              for (const line of tail) {
                try {
                  const evt = JSON.parse(line);
                  const icons: Record<string, string> = { tool_call: "🔧", model_turn: "🤖", delegation: "🔀", error: "❌" };
                  const icon = icons[evt.type] || "•";
                  console.log(`  ${icon} ${c.subtext0(evt.ts?.slice(11, 23) || "")} ${c.sky(evt.type)} ${JSON.stringify(evt.data).slice(0, 120)}`);
                } catch {
                  console.log(`  ${c.subtext0(line.slice(0, 120))}`);
                }
              }
              console.log();
            }
          } catch {
            console.log(c.peach("Could not read observability log."));
          }
        } else {
          // /obs off|console|file|both — set mode
          const valid = ["off", "console", "file", "both"];
          if (valid.includes(args[0])) {
            setObservabilityMode(args[0] as "off" | "console" | "file" | "both");
            console.log(c.green(`Observability set to: ${args[0]}`));
          } else {
            console.log(c.peach(`Invalid mode. Use: ${valid.join(", ")}`));
          }
        }
        break;
      }

      case "login": {
        const config = loadConfig();
        if (args[0]) {
          // /login <provider> — switch to a saved provider, or add a new one
          const targetId = args[0].toLowerCase();
          const existing = getProviderConfig(targetId);
          if (existing) {
            // Already saved — switch to it
            try {
              setDefaultProvider(targetId);
              applyProvider(targetId);
              console.log(
                c.green(`Switched to ${args[0]} (model: ${existing.model})`)
              );
            } catch (e: any) {
              console.log(c.red(`Error: ${e.message}`));
            }
          } else {
            // Not saved — launch setup wizard
            await runSetup(targetId);
          }
        } else {
          // /login with no args — show current provider and list saved ones
          console.log();
          console.log(
            c.text.bold("Default provider: ") +
              (config.defaultProvider
                ? c.green(config.defaultProvider)
                : c.subtext0("none"))
          );
          const saved = Object.entries(config.providers);
          if (saved.length > 0) {
            console.log();
            console.log(c.text.bold("Saved providers:"));
            for (const [id, pc] of saved) {
              const marker = id === config.defaultProvider ? c.green(" *") : " ";
              console.log(`${marker} ${c.sky(id)}  →  ${pc.model}`);
            }
            console.log(c.subtext0("\n  * = default. Use /login <provider> to switch."));
          } else {
            console.log(
              c.subtext0("No saved providers. Use /login <provider> to add one.")
            );
          }
          console.log();
        }
        break;
      }

      case "model":
        console.log(
          c.subtext0(`Current model: ${process.env.SAIL_MODEL || "default"}`)
        );
        if (args[0]) {
          process.env.SAIL_MODEL = args[0];
          console.log(c.green(`Model changed to: ${args[0]}`));
        }
        break;

      case "mode":
        console.log(c.subtext0(`Current mode: ${controller.mode}`));
        console.log(c.subtext0("Modes: chat (default), plan, build"));
        if (args[0]) {
          controller.switchMode(args[0] as AgentMode);
          console.log(c.green(`Switched to mode: ${args[0]}`));
        }
        break;

      case "tree": {
        console.log(c.text.bold("\nSession tree:"));
        const sessions = listSessions();
        for (const s of sessions.slice(0, 20)) {
          const prefix = s.parentId ? "  ├─" : "●";
          const marker =
            s.id === session?.id ? c.green(" (current)") : "";
          console.log(
            `  ${prefix} ${c.sky(s.id.slice(0, 8))}  ${s.name}${marker}  ${c.subtext0(new Date(s.updatedAt).toLocaleString())}`
          );
        }
        console.log();
        break;
      }

      case "sessions": {
        const sessions = listSessions().slice(0, 10);
        if (args[0]) {
          // /sessions <number> — switch to that session
          const idx = parseInt(args[0]) - 1;
          if (idx >= 0 && idx < sessions.length) {
            const picked = sessions[idx];
            console.log(c.green(`Switched to session: ${picked.name}`));
            return picked;
          } else {
            console.log(c.peach(`Invalid session number. Use /sessions to see the list.`));
          }
        } else {
          // /sessions — show numbered list
          console.log(c.text.bold("\nRecent sessions:"));
          for (let i = 0; i < sessions.length; i++) {
            const s = sessions[i];
            const marker = s.id === session?.id ? c.green(" *") : " ";
            console.log(
              `${marker} ${c.green(String(i + 1))}. ${c.sky(s.id.slice(0, 8))}  ${s.name}  ${c.subtext0(new Date(s.updatedAt).toLocaleString())}`
            );
          }
          console.log(c.subtext0("\n  Use /sessions <number> to switch sessions."));
          console.log();
        }
        break;
      }

      case "rename": {
        const newName = args.join(" ");
        if (!newName) {
          console.log(c.subtext0("Usage: /rename <new name>"));
        } else if (!session) {
          console.log(c.peach("No active session to rename."));
        } else {
          const ok = renameSession(session.id, newName);
          console.log(ok ? c.green(`Session renamed to: ${newName}`) : c.red("Session not found."));
        }
        break;
      }

      case "clear":
        process.stdout.write("\x1b[2J\x1b[0f");
        break;

      case "exit":
        console.log(c.subtext0("Goodbye!"));
        await flushObservability();
    process.exit(0);

      default:
        console.log(
          c.peach(
            `Unknown command: /${cmd}. Type /help for available commands.`
          )
        );
    }
  }
}

main().catch((error) => {
  console.error(c.red("Fatal error:"), error);
  process.exit(1);
});
