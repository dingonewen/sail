import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

/** Per-provider configuration */
export interface ProviderConfig {
  model: string;
  apiKey?: string;
}

/** Full Sail config stored in ~/.sail/config.json */
export interface SailConfig {
  /** Active provider id — set via setup wizard or /login */
  defaultProvider?: string;
  /** All saved providers (multiple can coexist) */
  providers: Record<string, ProviderConfig>;
  thinkingLevel?: string;
  sessionDir?: string;
  tools?: string[];
  excludeTools?: string[];
  verbose?: boolean;
  otlp?: {
    endpoint?: string;
    apiKey?: string;
  };
}

/** Provider metadata — id, display name, env var, default model */
export interface ProviderInfo {
  id: string;
  name: string;
  envVar: string;
  defaultModel: string;
}

export const PROVIDERS: ProviderInfo[] = [
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

const CONFIG_DIR = resolve(homedir(), ".sail");
const CONFIG_PATH = resolve(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: SailConfig = {
  providers: {},
};

/** Migrate old single-provider config to new multi-provider format */
function migrateConfig(raw: Record<string, unknown>): SailConfig {
  if (!raw.providers && raw.provider && typeof raw.provider === "string") {
    const oldProvider = raw.provider as string;
    const oldModel = (raw.model as string) || "";
    const oldKey = raw.apiKey as string | undefined;
    return {
      defaultProvider: oldProvider,
      providers: {
        [oldProvider]: {
          model: oldModel,
          apiKey: oldKey,
        },
      },
      thinkingLevel: raw.thinkingLevel as string | undefined,
      sessionDir: raw.sessionDir as string | undefined,
    };
  }
  return {
    defaultProvider: raw.defaultProvider as string | undefined,
    providers: (raw.providers || {}) as Record<string, ProviderConfig>,
    thinkingLevel: raw.thinkingLevel as string | undefined,
    sessionDir: raw.sessionDir as string | undefined,
    tools: raw.tools as string[] | undefined,
    excludeTools: raw.excludeTools as string[] | undefined,
    verbose: raw.verbose as boolean | undefined,
    otlp: raw.otlp as { endpoint?: string; apiKey?: string } | undefined,
  };
}

/** Load configuration from ~/.sail/config.json */
export function loadConfig(): SailConfig {
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      return migrateConfig(raw);
    } catch {
      console.warn(`Warning: failed to parse ${CONFIG_PATH}, using defaults`);
    }
  }
  return { ...DEFAULT_CONFIG };
}

/** Save full configuration to ~/.sail/config.json */
export function saveConfig(config: SailConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/** Get a specific provider's saved config */
export function getProviderConfig(providerId: string): ProviderConfig | undefined {
  const config = loadConfig();
  return config.providers[providerId];
}

/** Get the active (default) provider config */
export function getActiveProviderConfig(): ProviderConfig | undefined {
  const config = loadConfig();
  if (!config.defaultProvider) return undefined;
  return config.providers[config.defaultProvider];
}

/** Resolve the active provider id: CLI flag > model string > config default */
export function resolveProvider(
  cliProvider?: string,
  cliModel?: string
): string | undefined {
  if (cliProvider) return cliProvider;
  if (cliModel) {
    const id = cliModel.split("/")[0];
    if (id) return id;
  }
  const config = loadConfig();
  return config.defaultProvider;
}

/** Save a provider entry and optionally set as default */
export function saveProviderConfig(
  providerId: string,
  model: string,
  apiKey?: string,
  setDefault = true
): void {
  const config = loadConfig();
  config.providers[providerId] = { model, apiKey };
  if (setDefault) {
    config.defaultProvider = providerId;
  }
  saveConfig(config);
}

/** Set the active (default) provider */
export function setDefaultProvider(providerId: string): void {
  const config = loadConfig();
  if (!config.providers[providerId]) {
    throw new Error(
      `Provider "${providerId}" is not configured. Run /login to add it.`
    );
  }
  config.defaultProvider = providerId;
  saveConfig(config);
}

/** Check if ANY provider has been saved */
export function isConfigured(): boolean {
  const config = loadConfig();
  return !!(config.defaultProvider && config.providers[config.defaultProvider]);
}

/** Check if a specific provider has a saved entry */
export function isProviderConfigured(providerId: string): boolean {
  const config = loadConfig();
  return !!config.providers[providerId];
}

/** Get the config directory path (~/.sail) */
export function getConfigDir(): string {
  return CONFIG_DIR;
}

/** Look up provider metadata by id */
export function getProvider(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id.toLowerCase());
}

/**
 * Apply provider config to process.env so Mastra picks it up.
 *
 * Resolves: saved config > env var fallback.
 * Sets SAIL_MODEL and the provider-specific API key env var.
 */
export function applyProvider(
  providerId: string,
  cliModel?: string,
  cliKey?: string
): ProviderInfo {
  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(
      `Unknown provider: ${providerId}. Supported: ${PROVIDERS.map((p) => p.id).join(", ")}`
    );
  }

  // Resolve model: CLI flag > saved config > provider default
  const model =
    cliModel ||
    getProviderConfig(providerId)?.model ||
    provider.defaultModel;
  process.env.SAIL_MODEL = model;

  // Resolve API key: CLI flag > saved config > env var
  const savedKey = getProviderConfig(providerId)?.apiKey;
  const key = cliKey || savedKey || process.env[provider.envVar];
  if (key) {
    process.env[provider.envVar] = key;
  }

  return provider;
}

/**
 * Apply OTLP observability config from ~/.sail/config.json to process.env.
 * Called by both CLI and API server so Logfire (or any OTLP backend) works
 * without manual env vars.
 */
export function applyOtlp(): boolean {
  const config = loadConfig();
  if (!config.otlp?.endpoint) return false;

  process.env.SAIL_OTLP_ENDPOINT = config.otlp.endpoint;

  if (config.otlp.apiKey) {
    process.env.SAIL_OTLP_HEADERS = `Authorization=Bearer ${config.otlp.apiKey}`;
  }

  return true;
}

/**
 * Auto-apply the default provider on startup.
 * Returns the provider info if successful, or undefined if nothing is configured.
 */
export function autoApplyProvider(): ProviderInfo | undefined {
  const config = loadConfig();
  if (!config.defaultProvider) return undefined;

  const provider = getProvider(config.defaultProvider);
  if (!provider) return undefined;

  const saved = config.providers[config.defaultProvider];
  if (!saved) return undefined;

  process.env.SAIL_MODEL = saved.model || provider.defaultModel;

  const key = saved.apiKey || process.env[provider.envVar];
  if (key) {
    process.env[provider.envVar] = key;
  }

  return provider;
}
