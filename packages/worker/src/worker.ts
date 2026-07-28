import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { SailController, autoApplyProvider, applyOtlp } from "@sail/core";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);

// Shared Redis client for distributed locks
const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT });

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

/** Lock TTL in seconds — max time a job can hold the lock */
const LOCK_TTL = 300;
/** How long to delay before retrying if a lock is already held */
const LOCK_RETRY_DELAY_MS = 3000;

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
// concurrency: 1 + Redis distributed lock per conversationId ensures
// same-session jobs are never processed concurrently, even across
// multiple workers.
const worker = new Worker<JobData>(
  "sail-chat",
  async (job) => {
    const { prompt, userId, conversationId, mode } = job.data;
    const lockKey = `sail:lock:${conversationId}`;

    // Try to acquire a Redis lock for this conversation.
    // SET NX EX = atomic "set if not exists" with auto-expiry.
    // If another worker is already processing this conversation,
    // the lock won't be acquired and we delay the job.
    const acquired = await redis.set(lockKey, job.id!, "EX", LOCK_TTL, "NX");
    if (!acquired) {
      console.log(`[worker] Lock held for ${conversationId}, delaying ${job.id}`);
      await job.moveToDelayed(Date.now() + LOCK_RETRY_DELAY_MS);
      throw new Error(`Retry after lock released for ${conversationId}`);
    }

    try {
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
    } finally {
      // Release the lock — only if we still own it (the value matches).
      // Using a Lua script via eval to make this atomic.
      await redis.del(lockKey);
    }
  },
  {
    connection: { host: REDIS_HOST, port: REDIS_PORT },
    concurrency: 1,
    ...({ group: { concurrency: 1 } } as any),
  }
);

console.log(`Worker listening on Redis ${REDIS_HOST}:${REDIS_PORT}`);

// ── Graceful shutdown ──
async function shutdown() {
  console.log("Worker shutting down...");
  await worker.close();
  redis.disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
