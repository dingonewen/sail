import { createInterface } from "node:readline";
import { loadConfig, saveConfig, type SailConfig } from "./config.js";
import chalk from "chalk";

export interface ProviderInfo {
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

/** Look up a provider by id */
export function getProvider(id: string): ProviderInfo | undefined {
  return PROVIDERS.find(
    (p) => p.id === id.toLowerCase()
  );
}

/** Check if a specific provider has an API key available */
export function isProviderConfigured(providerId: string): boolean {
  const provider = getProvider(providerId);
  if (!provider) return false;
  if (process.env[provider.envVar]) return true;

  const config = loadConfig();
  if (config.provider === provider.id && config.apiKey) return true;

  return false;
}

/** Check if ANY provider has an API key available */
export function isConfigured(): boolean {
  const config = loadConfig();
  if (config.provider && config.apiKey) return true;

  for (const p of PROVIDERS) {
    if (process.env[p.envVar]) return true;
  }

  return false;
}

/** Apply provider config: set env vars for model and API key */
export function applyProvider(providerId: string): ProviderInfo {
  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(
      `Unknown provider: ${providerId}. Run --list-providers to see supported providers.`
    );
  }

  // Set model
  process.env.SAIL_MODEL = provider.defaultModel;

  // Use API key from env if available
  if (process.env[provider.envVar]) {
    process.env.SAIL_API_KEY = process.env[provider.envVar];
  }

  return provider;
}

/** Run the first-run setup wizard for a specific provider, or let user choose */
export async function runSetup(preferredProviderId?: string): Promise<SailConfig> {
  let provider: ProviderInfo;

  if (preferredProviderId) {
    const found = getProvider(preferredProviderId);
    if (!found) {
      console.log(
        chalk.yellow(`Unknown provider '${preferredProviderId}'. Showing all options.`)
      );
    } else {
      provider = found;
    }
  }

  // If no preferred provider or not found, let user choose
  if (!provider!) {
    console.log();
    console.log(chalk.bold("Welcome to Sail!"));
    console.log(chalk.dim("Let's set up your AI provider."));
    console.log();
    console.log(chalk.bold("Available providers:"));
    for (let i = 0; i < PROVIDERS.length; i++) {
      const p = PROVIDERS[i];
      const envSet = process.env[p.envVar]
        ? chalk.green(" (key found in env)")
        : "";
      console.log(`  ${chalk.cyan(String(i + 1))}. ${p.name}${envSet}`);
    }
    console.log();

    const choice = await ask(
      `Select a provider ${chalk.dim("(1-" + PROVIDERS.length + ")")}: `
    );
    const idx = parseInt(choice) - 1;
    provider = PROVIDERS[idx] || PROVIDERS[0];

    if (!PROVIDERS[idx]) {
      console.log(chalk.yellow(`Invalid choice, using ${provider.name}`));
    }
  }

  // Get API key
  const existingKey = process.env[provider!.envVar];
  if (existingKey) {
    console.log(
      chalk.green(`Using ${provider!.envVar} from environment.`)
    );
  } else {
    console.log();
    console.log(
      chalk.dim(
        `Set the ${provider!.envVar} environment variable, or enter it below.`
      )
    );
    console.log(
      chalk.dim(`Get your key at: ${getKeyUrl(provider!.id)}`)
    );
    const key = await ask(`${provider!.envVar}: `);
    if (key) {
      process.env[provider!.envVar] = key;
    }
  }

  // Apply
  applyProvider(provider!.id);

  // Save to file
  const config: SailConfig = {
    provider: provider!.id,
    model: provider!.defaultModel,
    apiKey: process.env[provider!.envVar],
  };
  saveConfig(config);

  console.log();
  console.log(chalk.green(`✓ Configured! Provider: ${provider!.name}`));
  console.log(chalk.dim(`  Model: ${provider!.defaultModel}`));
  console.log(chalk.dim(`  Config saved to ~/.sail/config.json`));
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
