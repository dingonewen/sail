import { SailController } from "@sail/core";
import type { JobQueue } from "./queue.js";

const POLL_INTERVAL_MS = 100;

const MAX_STEPS: Record<string, number> = {
  chat: 10,
  plan: 15,
  build: 25,
};

/**
 * Start the job processing loop.
 *
 * Polls the queue every second. When a job is available, processes it
 * sequentially — job 2 never starts before job 1 completes. This is
 * enforced by the queue's internal `processing` flag.
 *
 * Uses stream() (not generate()) so observability records individual
 * tool call spans in onStepFinish, not just the final model_turn.
 */
export function startWorker(queue: JobQueue): void {
  const controller = new SailController();

  // API context — no human to approve tool calls
  controller.setAutoApprove(true);

  async function tick(): Promise<void> {
    const job = queue.dequeue();

    if (job) {
      try {
        controller.switchMode(job.mode);

        let accumulated = "";
        await controller.stream(job.prompt, {
          resource: job.userId,
          thread: job.conversationId,
          maxSteps: MAX_STEPS[job.mode] ?? 10,
          onTextChunk: (chunk: string) => {
            accumulated += chunk;
          },
        });

        queue.updateJob(job.taskId, {
          status: "done",
          result: accumulated || "(no output)",
        });
      } catch (err) {
        queue.updateJob(job.taskId, {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Schedule next poll regardless of whether a job was processed.
    // Using setTimeout (not setInterval) avoids concurrent ticks.
    setTimeout(tick, POLL_INTERVAL_MS);
  }

  // Kick off the loop — fire immediately on startup.
  tick();
}
