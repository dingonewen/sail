import { Queue, type Job as BullJob } from "bullmq";
import { randomUUID } from "node:crypto";

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface JobData {
  prompt: string;
  userId: string;
  conversationId: string;
  mode: "chat" | "plan" | "build";
}

export interface CreateJobInput {
  userId?: string;
  conversationId?: string;
  prompt: string;
  mode?: "chat" | "plan" | "build";
}

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);

let _queue: Queue<JobData> | null = null;

function getQueue(): Queue<JobData> {
  if (!_queue) {
    _queue = new Queue<JobData>("sail-chat", {
      connection: { host: REDIS_HOST, port: REDIS_PORT },
    });
  }
  return _queue;
}

function mapStatus(bullStatus: string | null): JobStatus {
  switch (bullStatus) {
    case "waiting":
    case "delayed":
    case "waiting-children":
      return "queued";
    case "active":
      return "running";
    case "completed":
      return "done";
    case "failed":
      return "failed";
    default:
      return "queued";
  }
}

function fromBullJob(j: BullJob<JobData>) {
  return {
    taskId: j.id!,
    userId: j.data.userId,
    conversationId: j.data.conversationId,
    prompt: j.data.prompt,
    mode: j.data.mode,
    status: mapStatus(j.finishedOn ? "completed" : j.failedReason ? "failed" : "queued"),
    result: j.returnvalue?.result,
    error: j.failedReason,
    createdAt: j.timestamp,
    updatedAt: j.processedOn || j.timestamp,
  };
}

/**
 * BullMQ-backed job queue. Same interface as the old in-memory queue
 * so routes don't need to change.
 */
export class JobQueue {
  /** Create a job and push it onto the Redis-backed queue. */
  async enqueue(input: CreateJobInput) {
    const q = getQueue();
    const taskId = randomUUID();
    const data: JobData = {
      prompt: input.prompt,
      userId: input.userId || "anonymous",
      conversationId: input.conversationId || randomUUID(),
      mode: input.mode || "chat",
    };

    await q.add("chat", data, { jobId: taskId });

    return {
      taskId,
      status: "queued" as JobStatus,
    };
  }

  /** Get a job by taskId from Redis. */
  async getJob(taskId: string) {
    const q = getQueue();
    const job = await q.getJob(taskId);
    if (!job) return undefined;

    // Determine actual status
    const state = await job.getState();
    return fromBullJob(job);
  }

  /** List recent jobs (newest first). */
  async listJobs() {
    const q = getQueue();

    // Get jobs from all states
    const allStates: ("completed" | "failed" | "active" | "delayed" | "waiting" | "waiting-children")[] =
      ["completed", "failed", "active", "delayed", "waiting", "waiting-children"];

    const jobs = await q.getJobs(allStates, 0, 50);
    return jobs.map(fromBullJob).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  /** Number of waiting jobs. */
  async pendingCount() {
    const q = getQueue();
    const waiting = await q.getWaitingCount();
    return waiting;
  }

  /** Close the Redis connection. */
  async close() {
    if (_queue) {
      await _queue.close();
      _queue = null;
    }
  }
}
