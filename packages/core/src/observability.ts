import { Observability, ConsoleExporter } from "@mastra/observability";

let _observability: Observability | null = null;

/**
 * Create an Observability instance with Mastra-native tracing.
 * Records every tool call (name, args, result, duration)
 * and model turn (tokens, latency) via OpenTelemetry.
 *
 * Uses ConsoleExporter for development — upgrade to
 * MastraStorageExporter or OTLP for production.
 */
export function createObservability(): Observability {
  if (_observability) return _observability;

  _observability = new Observability({
    configs: {
      sail: {
        serviceName: "sail",
        exporters: [new ConsoleExporter()],
      },
    },
  });

  return _observability;
}
