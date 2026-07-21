import Fastify from "fastify";
import cors from "@fastify/cors";
import { autoApplyProvider, loadConfig } from "@sail/core";
import { JobQueue } from "./queue.js";
import { startWorker } from "./worker.js";
import { chatRoutes } from "./routes/chat.js";

const PORT = parseInt(process.env.SAIL_API_PORT || "3000", 10);
const HOST = process.env.SAIL_API_HOST || "0.0.0.0";

export async function buildServer() {
  // ── Provider — auto-load from ~/.sail/config.json ──
  // Reuses the same multi-provider config as the CLI — no need to
  // set SAIL_MODEL or API keys manually.
  const provider = autoApplyProvider();
  const config = loadConfig();

  const app = Fastify({ logger: true });

  // Allow all origins during development — tighten for production.
  await app.register(cors, { origin: true });

  // ── Queue & worker ──
  const queue = new JobQueue();

  // Start the worker loop. It polls the queue every second and processes
  // jobs sequentially — second job never interrupts the first.
  startWorker(queue);

  // ── Routes ──
  // Inject queue into routes so they're testable with a mock.
  await app.register(chatRoutes(queue));

  // ── Root — friendly landing page ──
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
  <p><a href="/health">→ Health check</a></p>
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
