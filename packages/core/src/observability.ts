import { Observability, ConsoleExporter } from "@mastra/observability";

let _observability: Observability | null = null;

/**
 * Create an Observability instance with Mastra-native tracing.
 * Records every tool call (name, args, result, duration)
 * and model turn (tokens, latency) via OpenTelemetry.
 *
 * Only enabled when SAIL_OBSERVABILITY=console is set.
 * Upgrade to MastraStorageExporter or OTLP for production.
 */
export function createObservability(): Observability {
  if (_observability) return _observability;

  const enabled = process.env.SAIL_OBSERVABILITY === "console";

  _observability = new Observability({
    configs: enabled ? {
      sail: {
        serviceName: "sail",
        exporters: [new ConsoleExporter()],
      },
    } : {},
  });

  return _observability;
}
