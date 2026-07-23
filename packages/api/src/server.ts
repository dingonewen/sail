import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { autoApplyProvider, applyOtlp, loadConfig } from "@sail/core";
import { JobQueue } from "./queue.js";
import { startWorker } from "./worker.js";
import { chatRoutes } from "./routes/chat.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.SAIL_API_PORT || "3000", 10);
const HOST = process.env.SAIL_API_HOST || "0.0.0.0";

export async function buildServer() {
  // ── Provider — auto-load from ~/.sail/config.json ──
  // Reuses the same multi-provider config as the CLI — no need to
  // set SAIL_MODEL or API keys manually.
  const provider = autoApplyProvider();
  const config = loadConfig();

  const app = Fastify({ logger: true });

  // OTLP (Logfire) is off by default. Set SAIL_OBSERVABILITY=file or =console to enable.
  if (process.env.SAIL_OBSERVABILITY && process.env.SAIL_OBSERVABILITY !== "off") {
    applyOtlp();
    app.log.info(`Logfire enabled (endpoint: ${process.env.SAIL_OTLP_ENDPOINT || "?"})`);
  } else {
    app.log.info("Logfire disabled — set SAIL_OBSERVABILITY=file to enable");
  }

  // Allow all origins during development — tighten for production.
  await app.register(cors, { origin: true });

  // ── Swagger / OpenAPI — http://localhost:3000/docs ──
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Sail API",
        description: "Async job queue wrapping the Sail coding agent",
        version: "0.1.0",
      },
    },
  });
  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
  });

  // ── Queue & worker ──
  const queue = new JobQueue();

  // Start the worker loop. It polls the queue every second and processes
  // jobs sequentially — second job never interrupts the first.
  startWorker(queue);

  // ── Routes ──
  // Inject queue into routes so they're testable with a mock.
  await app.register(chatRoutes(queue));

  // ── Static test pages — open http://localhost:3000/test/vanilla ──
  // Serves packages/api/test/ so you don't need to find the files on disk.
  await app.register(fastifyStatic, {
    root: resolve(__dirname, "..", "test"),
    prefix: "/test/",
  });

  // ── Root — links to test pages ──
  app.get("/", async (_req, reply) => {
    reply.type("text/html").send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Sail API</title>
<style>
  body { font-family: system-ui; max-width: 600px; margin: 60px auto; padding: 20px; background: #1e1e2e; color: #cdd6f4; }
  h1 { color: #cba6f7; } code { background: #313244; padding: 2px 6px; border-radius: 3px; }
  a { color: #89b4fa; }
</style></head>
<body>
  <h1>Sail API</h1>
  <p>Provider: <strong>${provider?.name ?? "not configured"}</strong> (${process.env.SAIL_MODEL || "none"})</p>
  <p>Endpoints:</p>
  <ul>
    <li><code>POST /chat</code> — submit a message</li>
    <li><code>GET /chat/:taskId</code> — poll for result</li>
    <li><code>GET /health</code> — health check</li>
  </ul>
  <p><a href="/docs">→ Swagger UI</a></p>
  <p><a href="/test/test-vanilla.html">→ Vanilla JS test page</a></p>
  <p><a href="/test/test-react.html">→ React test page</a></p>
</body></html>`);
  });

  // ── Health check ──
  app.get("/health", async () => ({
    status: "ok",
    pendingJobs: queue.pendingCount,
    provider: provider
      ? { id: provider.id, model: process.env.SAIL_MODEL }
      : null,
    savedProviders: Object.keys(config.providers),
  }));

  return app;
}

// ── Start ──
// Only start listening when this file is run directly (not imported for testing).
const app = await buildServer();

try {
  await app.listen({ port: PORT, host: HOST });

  const provider = autoApplyProvider();
  if (!provider) {
    app.log.warn(
      "No provider configured. Run 'sail' CLI first to set up a provider, " +
      "or set SAIL_MODEL and API key env vars."
    );
  } else {
    app.log.info(`Provider: ${provider.name} (${process.env.SAIL_MODEL})`);
  }

  app.log.info(`Sail API listening on http://${HOST}:${PORT}`);
  app.log.info(`POST /chat — submit a message`);
  app.log.info(`GET  /chat/:taskId — poll for result`);
  app.log.info(`GET  /health — health check`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export default app;
