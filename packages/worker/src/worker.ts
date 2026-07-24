import { Worker } from "bullmq";
import { SailController, autoApplyProvider, applyOtlp } from "@sail/core";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);

interface JobData {
  prompt: string;
  userId: string;
  conversationId: string;
  mode: "chat" | "plan" | "build";
}

const MAX_STEPS: Record<string, number> = {
  chat: 10,
  plan: 15,
  build: 25,
};

// ── Provider — auto-load from ~/.sail/config.json ──
const provider = autoApplyProvider();
if (provider) {
  console.log(`Worker provider: ${provider.name} (${process.env.SAIL_MODEL})`);
} else {
  console.warn("Worker: no provider configured. Set SAIL_MODEL and API key env vars.");
}

// ── OTLP — enable Logfire if SAIL_OBSERVABILITY is set ──
if (process.env.SAIL_OBSERVABILITY && process.env.SAIL_OBSERVABILITY !== "off") {
  applyOtlp();
  console.log("Worker: Logfire enabled");
}

// ── BullMQ Worker ──
// concurrency: 1 ensures sequential processing — job 2 never interrupts job 1.
const worker = new Worker<JobData>(
  "sail-chat",
  async (job) => {
    const { prompt, userId, conversationId, mode } = job.data;

    console.log(`[worker] Processing ${job.id} (mode: ${mode})`);

    const controller = new SailController();
    controller.setAutoApprove(true);
    controller.switchMode(mode || "chat");

    let accumulated = "";
    await controller.stream(prompt, {
      resource: userId,
      thread: conversationId,
      maxSteps: MAX_STEPS[mode] ?? 10,
      onTextChunk: (chunk: string) => {
        accumulated += chunk;
      },
    });

    console.log(`[worker] Completed ${job.id}`);
    return { result: accumulated || "(no output)" };
  },
  {
    connection: { host: REDIS_HOST, port: REDIS_PORT },
    concurrency: 1,
  }
);

console.log(`Worker listening on Redis ${REDIS_HOST}:${REDIS_PORT}`);

// ── Graceful shutdown ──
async function shutdown() {
  console.log("Worker shutting down...");
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
