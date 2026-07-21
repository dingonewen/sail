// Re-export provider config from @sail/core (single source of truth).
// The config module was moved to core so both CLI and API can share it
// without the API pulling in chalk, commander, or other terminal deps.
export {
  loadConfig,
  saveConfig,
  getProviderConfig,
  getActiveProviderConfig,
  resolveProvider,
  saveProviderConfig,
  setDefaultProvider,
  isConfigured,
  isProviderConfigured,
  getConfigDir,
  getProvider,
  applyProvider,
  PROVIDERS,
} from "@sail/core";
export type { SailConfig, ProviderConfig, ProviderInfo } from "@sail/core";
