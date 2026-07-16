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

const CONFIG_DIR = resolve(homedir(), ".sail");
const CONFIG_PATH = resolve(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: SailConfig = {
  providers: {},
};

/** Migrate old single-provider config to new multi-provider format */
function migrateConfig(raw: Record<string, unknown>): SailConfig {
  // Old format had top-level { provider, model, apiKey }
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
  // Already new format (or empty) — coerce to expect shapes
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
export function getProviderConfig(
  providerId: string
): ProviderConfig | undefined {
  const config = loadConfig();
  return config.providers[providerId];
}

/** Get the active (default) provider config */
export function getActiveProviderConfig(): ProviderConfig | undefined {
  const config = loadConfig();
  if (!config.defaultProvider) return undefined;
  return config.providers[config.defaultProvider];
}

/** Resolve the active provider id: CLI flag > config.defaultProvider */
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
    throw new Error(`Provider "${providerId}" is not configured. Run /login to add it.`);
  }
  config.defaultProvider = providerId;
  saveConfig(config);
}

/** Check if ANY provider has been saved (controls whether wizard runs) */
export function isConfigured(): boolean {
  const config = loadConfig();
  return !!(config.defaultProvider && config.providers[config.defaultProvider]);
}

/** Check if a specific provider has a saved entry */
export function isProviderConfigured(providerId: string): boolean {
  const config = loadConfig();
  return !!config.providers[providerId];
}

/** Get the config directory path */
export function getConfigDir(): string {
  return CONFIG_DIR;
}
