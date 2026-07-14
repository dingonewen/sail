import { Observability, MastraStorageExporter } from "@mastra/observability";

export function createObservability(): Observability {
  return new Observability({
    configs: {
      default: {
        serviceName: "sail",
        exporters: [new MastraStorageExporter()],
        logging: {
          enabled: true,
          level: "info",
        },
      },
    },
  });
}
