import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

export interface SailConfig {
  model?: string;
  provider?: string;
  apiKey?: string;
  thinkingLevel?: string;
  sessionDir?: string;
  tools?: string[];
  excludeTools?: string[];
  verbose?: boolean;
}

const CONFIG_DIR = resolve(homedir(), ".sail");
const CONFIG_PATH = resolve(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: SailConfig = {
  model: process.env.SAIL_MODEL,
  provider: process.env.SAIL_PROVIDER,
  apiKey: process.env.SAIL_API_KEY,
};

/** Load configuration from ~/.sail/config.json merged with env vars */
export function loadConfig(): SailConfig {
  let fileConfig: SailConfig = {};

  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      fileConfig = JSON.parse(raw);
    } catch {
      console.warn(`Warning: failed to parse ${CONFIG_PATH}, using defaults`);
    }
  }

  // Env vars take precedence over file config
  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    model: process.env.SAIL_MODEL || fileConfig.model,
    provider: process.env.SAIL_PROVIDER || fileConfig.provider,
    apiKey: process.env.SAIL_API_KEY || fileConfig.apiKey,
  };
}

/** Save configuration to ~/.sail/config.json */
export function saveConfig(config: SailConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/** Get the config directory path */
export function getConfigDir(): string {
  return CONFIG_DIR;
}
