import { createInterface } from "node:readline";
import {
  loadConfig,
  saveProviderConfig,
  getProviderConfig,
  isConfigured as configIsConfigured,
  isProviderConfigured as configIsProviderConfigured,
  getProvider,
  applyProvider,
  PROVIDERS,
  type SailConfig,
  type ProviderInfo,
} from "./config.js";
import chalk from "chalk";

const c = {
  peach: chalk.hex("#fe640b"),
  red: chalk.hex("#d20f39"),
  green: chalk.hex("#40a02b"),
  sky: chalk.hex("#04a5e5"),
  mauve: chalk.hex("#8839ef"),
  text: chalk.hex("#4c4f69"),
  subtext0: chalk.hex("#6c6f85"),
};

// ProviderInfo, PROVIDERS, getProvider, applyProvider are imported from ./config.js
// which re-exports from @sail/core.

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Re-export config checks (delegate to config.ts)
export { configIsConfigured as isConfigured };
export { configIsProviderConfigured as isProviderConfigured };

// Re-export functions moved to @sail/core — main.ts still imports from here
export { getProvider, applyProvider } from "./config.js";

/** Run the setup wizard — always prompts, even if env var exists */
export async function runSetup(preferredProviderId?: string): Promise<SailConfig> {
  let provider: ProviderInfo | undefined;

  if (preferredProviderId) {
    provider = getProvider(preferredProviderId);
    if (!provider) {
      console.log(
        c.peach(`Unknown provider '${preferredProviderId}'. Showing all options.`)
      );
    }
  }

  // If no preferred provider or not found, let user choose
  if (!provider) {
    console.log();
    console.log(c.text.bold("Welcome to Sail!"));
    console.log(c.subtext0("Let's set up your AI provider."));
    console.log();
    console.log(c.text.bold("Available providers:"));
    for (let i = 0; i < PROVIDERS.length; i++) {
      const p = PROVIDERS[i];
      const saved = getProviderConfig(p.id);
      const status = saved
        ? c.green(" (saved)")
        : process.env[p.envVar]
          ? c.green(" (key found in env)")
          : "";
      console.log(`  ${c.sky(String(i + 1))}. ${p.name}${status}`);
    }
    console.log();

    const choice = await ask(
      `Select a provider ${c.subtext0("(1-" + PROVIDERS.length + ")")}: `
    );
    const idx = parseInt(choice) - 1;
    provider = PROVIDERS[idx] || PROVIDERS[0];

    if (!PROVIDERS[idx]) {
      console.log(c.peach(`Invalid choice, using ${provider.name}`));
    }
  }

  // Always prompt for API key — show masked env var as hint if available
  const existingKey = process.env[provider.envVar];
  console.log();
  if (existingKey) {
    const masked = existingKey.slice(0, 8) + "..." + existingKey.slice(-4);
    console.log(
      c.subtext0(`Found ${provider.envVar} in environment: ${masked}`)
    );
    console.log(
      c.subtext0("Press Enter to use this key, or type a different one.")
    );
  } else {
    console.log(
      c.subtext0(
        `Set the ${provider.envVar} environment variable, or enter it below.`
      )
    );
  }
  console.log(c.subtext0(`Get your key at: ${getKeyUrl(provider.id)}`));
  const key = await ask(`${provider.envVar}: `);
  if (key) {
    process.env[provider.envVar] = key;
  } else if (existingKey) {
    // User pressed Enter — keep the existing env var
  }

  // Save to multi-provider config
  const savedKey = key || existingKey;
  saveProviderConfig(provider.id, provider.defaultModel, savedKey, true);
  applyProvider(provider.id);

  console.log();
  console.log(c.green(`✓ Configured! Provider: ${provider.name}`));
  console.log(c.subtext0(`  Model: ${provider.defaultModel}`));
  console.log(c.subtext0(`  Config saved to ~/.sail/config.json`));

  const config = loadConfig();
  const savedProviders = Object.keys(config.providers);
  if (savedProviders.length > 1) {
    console.log(c.subtext0(`  Saved providers: ${savedProviders.join(", ")}`));
    console.log(c.subtext0(`  Default: ${config.defaultProvider}`));
  }
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

/** List providers with both env-var and saved-config status */
export function listProviders(): void {
  const config = loadConfig();
  console.log(c.text.bold("\nSupported providers:\n"));
  for (const p of PROVIDERS) {
    const saved = config.providers[p.id];
    const isDefault = config.defaultProvider === p.id;
    const envSet = process.env[p.envVar];

    let status: string;
    if (saved && isDefault) {
      status = c.green(" ✓ saved (default)");
    } else if (saved) {
      status = c.green(" ✓ saved");
    } else if (envSet) {
      status = c.peach(" env var set (not saved)");
    } else {
      status = c.subtext0(" - not configured");
    }

    const marker = isDefault ? c.text.bold("* ") : "  ";
    console.log(
      `${marker}${c.sky(p.id.padEnd(12))} ${p.name.padEnd(24)} ${p.envVar}${status}`
    );
  }
  console.log(c.subtext0("\n  * = default provider. Run /login to switch.\n"));
}
