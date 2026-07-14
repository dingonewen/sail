import { createInterface } from "node:readline";
import { loadConfig, saveConfig, type SailConfig } from "./config.js";
import chalk from "chalk";

interface ProviderInfo {
  id: string;
  name: string;
  envVar: string;
  defaultModel: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    envVar: "ANTHROPIC_API_KEY",
    defaultModel: "anthropic/claude-sonnet-4-6",
  },
  {
    id: "openai",
    name: "OpenAI (GPT)",
    envVar: "OPENAI_API_KEY",
    defaultModel: "openai/gpt-5.5",
  },
  {
    id: "google",
    name: "Google (Gemini)",
    envVar: "GOOGLE_API_KEY",
    defaultModel: "google/gemini-pro",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    envVar: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek/deepseek-chat",
  },
];

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Check if a config already exists with a valid provider setup */
export function isConfigured(): boolean {
  const config = loadConfig();

  // Check config file
  if (config.provider && config.apiKey) return true;

  // Check env vars for known providers
  for (const p of PROVIDERS) {
    if (process.env[p.envVar]) return true;
  }

  return false;
}

/** Run the first-run setup wizard */
export async function runSetup(): Promise<SailConfig> {
  console.log();
  console.log(chalk.bold("Welcome to Sail!"));
  console.log(chalk.dim("Let's set up your AI provider."));
  console.log();

  // Show providers
  console.log(chalk.bold("Available providers:"));
  for (let i = 0; i < PROVIDERS.length; i++) {
    const p = PROVIDERS[i];
    const envSet = process.env[p.envVar]
      ? chalk.green(" (key found in env)")
      : "";
    console.log(`  ${chalk.cyan(String(i + 1))}. ${p.name}${envSet}`);
  }
  console.log();

  // Select provider
  const choice = await ask(
    `Select a provider ${chalk.dim("(1-" + PROVIDERS.length + ")")}: `
  );
  const idx = parseInt(choice) - 1;
  const provider = PROVIDERS[idx] || PROVIDERS[0];

  if (!PROVIDERS[idx]) {
    console.log(chalk.yellow(`Invalid choice, using ${provider.name}`));
  }

  // Get API key
  const existingKey = process.env[provider.envVar];
  if (existingKey) {
    console.log(
      chalk.green(`Using ${provider.envVar} from environment.`)
    );
  } else {
    console.log();
    console.log(
      chalk.dim(
        `Set the ${provider.envVar} environment variable, or enter it below.`
      )
    );
    console.log(
      chalk.dim(
        `Get your key at: ${getKeyUrl(provider.id)}`
      )
    );
    const key = await ask(`${provider.envVar}: `);
    if (key) {
      process.env[provider.envVar] = key;
    }
  }

  // Build config
  const config: SailConfig = {
    provider: provider.id,
    model: provider.defaultModel,
    apiKey: process.env[provider.envVar],
  };

  // Save to file
  saveConfig(config);

  console.log();
  console.log(
    chalk.green(`✓ Configured! Provider: ${provider.name}`)
  );
  console.log(
    chalk.dim(`  Model: ${provider.defaultModel}`)
  );
  console.log(
    chalk.dim(`  Config saved to ~/.sail/config.json`)
  );
  console.log();
  console.log(
    chalk.dim("You can change this anytime with /model in interactive mode.")
  );
  console.log();

  return config;
}

function getKeyUrl(providerId: string): string {
  switch (providerId) {
    case "anthropic":
      return "https://console.anthropic.com/";
    case "openai":
      return "https://platform.openai.com/api-keys";
    case "google":
      return "https://aistudio.google.com/apikey";
    case "deepseek":
      return "https://platform.deepseek.com/api_keys";
    default:
      return "";
  }
}

/** List available providers with their env var status */
export function listProviders(): void {
  console.log(chalk.bold("\nSupported providers:\n"));
  for (const p of PROVIDERS) {
    const envSet = process.env[p.envVar]
      ? chalk.green(" ✓ configured")
      : chalk.dim(" - not set");
    console.log(
      `  ${chalk.cyan(p.id.padEnd(12))} ${p.name.padEnd(24)} ${p.envVar}${envSet}`
    );
  }
  console.log();
}
