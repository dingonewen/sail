import { randomUUID } from "node:crypto";

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface Job {
  taskId: string;
  userId: string;
  conversationId: string;
  prompt: string;
  mode: "chat" | "plan" | "build";
  status: JobStatus;
  result?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateJobInput {
  userId?: string;
  conversationId?: string;
  prompt: string;
  mode?: "chat" | "plan" | "build";
}

/**
 * In-memory FIFO job queue.
 *
 * Interface is intentionally aligned with BullMQ so swapping to Redis
 * later only requires changing the implementation, not the callers.
 */
export class JobQueue {
  private jobs = new Map<string, Job>();
  private queue: string[] = [];
  private processing = false;

  /** Number of jobs currently queued (not yet running or done). */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** Create a job and push it onto the queue. */
  enqueue(input: CreateJobInput): Job {
    const job: Job = {
      taskId: randomUUID(),
      userId: input.userId || "anonymous",
      conversationId: input.conversationId || randomUUID(),
      prompt: input.prompt,
      mode: input.mode || "chat",
      status: "queued",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.jobs.set(job.taskId, job);
    this.queue.push(job.taskId);
    return job;
  }

  /** Get a job by taskId. */
  getJob(taskId: string): Job | undefined {
    return this.jobs.get(taskId);
  }

  /**
   * Dequeue the next pending job and mark it as running.
   * Returns undefined if the queue is empty or already processing.
   */
  dequeue(): Job | undefined {
    if (this.processing) return undefined;

    const taskId = this.queue.shift();
    if (!taskId) return undefined;

    const job = this.jobs.get(taskId);
    if (!job) return undefined;

    this.processing = true;
    job.status = "running";
    job.updatedAt = Date.now();
    return job;
  }

  /** Update job fields after processing. */
  updateJob(taskId: string, partial: Partial<Pick<Job, "status" | "result" | "error">>): void {
    const job = this.jobs.get(taskId);
    if (!job) return;

    Object.assign(job, partial);
    job.updatedAt = Date.now();
    this.processing = false;
  }

  /** List all jobs (newest first) — for debugging. */
  listJobs(): Job[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
  }
}
