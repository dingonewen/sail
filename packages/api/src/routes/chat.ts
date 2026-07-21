import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { JobQueue, CreateJobInput } from "../queue.js";

/** JSON schema for POST /chat request body validation */
const postChatSchema = {
  type: "object",
  required: ["message"],
  properties: {
    message: { type: "string", minLength: 1 },
    userId: { type: "string" },
    conversationId: { type: "string" },
    mode: { type: "string", enum: ["chat", "plan", "build"] },
  },
};

/**
 * Register chat routes on a Fastify instance.
 *
 * The queue is injected so routes don't depend on module-level state —
 * makes testing straightforward (just pass a mock queue).
 */
export function chatRoutes(queue: JobQueue): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    /** POST /chat — submit a message, get back a taskId immediately */
    app.post("/chat", { schema: { body: postChatSchema } }, async (request, reply) => {
      const { message, userId, conversationId, mode } = request.body as {
        message: string;
        userId?: string;
        conversationId?: string;
        mode?: "chat" | "plan" | "build";
      };

      const input: CreateJobInput = {
        prompt: message.trim(),
        userId,
        conversationId,
        mode,
      };

      const job = queue.enqueue(input);

      reply.code(201).send({
        taskId: job.taskId,
        status: job.status,
      });
    });

    /** GET /chat/:taskId — poll for job status and result */
    app.get("/chat/:taskId", async (request, reply) => {
      const { taskId } = request.params as { taskId: string };
      const job = queue.getJob(taskId);

      if (!job) {
        reply.code(404).send({ error: `Job not found: ${taskId}` });
        return;
      }

      reply.send({
        taskId: job.taskId,
        status: job.status,
        ...(job.result ? { result: job.result } : {}),
        ...(job.error ? { error: job.error } : {}),
      });
    });

    /** GET /chat — list all jobs (useful for debugging) */
    app.get("/chat", async (_request, reply) => {
      const jobs = queue.listJobs().map((j) => ({
        taskId: j.taskId,
        status: j.status,
        userId: j.userId,
        mode: j.mode,
        prompt: j.prompt.slice(0, 80),
        createdAt: new Date(j.createdAt).toISOString(),
      }));
      reply.send({ jobs, pendingCount: queue.pendingCount });
    });
  };
}
