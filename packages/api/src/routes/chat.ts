import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { JobQueue, CreateJobInput } from "../queue.js";

/** JSON schema for POST /chat request body */
const postChatBody = {
  type: "object",
  required: ["message"],
  properties: {
    message: { type: "string", minLength: 1, description: "The message to send to the agent" },
    userId: { type: "string", description: "User identifier for memory isolation" },
    conversationId: { type: "string", description: "Conversation thread ID for multi-turn conversations" },
    mode: { type: "string", enum: ["chat", "plan", "build"], description: "Agent mode" },
  },
} as const;

const postChatResponse = {
  201: {
    type: "object",
    properties: {
      taskId: { type: "string" },
      status: { type: "string" },
    },
  },
} as const;

const getChatResponse = {
  200: {
    type: "object",
    properties: {
      taskId: { type: "string" },
      status: { type: "string", enum: ["queued", "running", "done", "failed"] },
      result: { type: "string" },
      error: { type: "string" },
    },
  },
  404: {
    type: "object",
    properties: {
      error: { type: "string" },
    },
  },
} as const;

/**
 * Register chat routes on a Fastify instance.
 *
 * The queue is injected so routes don't depend on module-level state —
 * makes testing straightforward (just pass a mock queue).
 */
export function chatRoutes(queue: JobQueue): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    app.post("/chat", {
      schema: {
        tags: ["chat"],
        description: "Submit a message to the agent. Returns a taskId immediately — the agent processes the message asynchronously.",
        body: postChatBody,
        response: postChatResponse,
      },
    }, async (request, reply) => {
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

      const job = await queue.enqueue(input);

      reply.code(201).send({
        taskId: job.taskId,
        status: job.status,
      });
    });

    app.get("/chat/:taskId", {
      schema: {
        tags: ["chat"],
        description: "Poll for a job's status and result. Jobs are processed sequentially — a second job never interrupts the first.",
        params: {
          type: "object",
          required: ["taskId"],
          properties: {
            taskId: { type: "string", description: "The task ID returned by POST /chat" },
          },
        },
        response: getChatResponse,
      },
    }, async (request, reply) => {
      const { taskId } = request.params as { taskId: string };
      const job = await queue.getJob(taskId);

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

    app.get("/chat", {
      schema: {
        tags: ["chat"],
        description: "List all jobs (useful for debugging).",
        response: {
          200: {
            type: "object",
            properties: {
              jobs: { type: "array" },
              pendingCount: { type: "number" },
            },
          },
        },
      },
    }, async (_request, reply) => {
      const jobs = (await queue.listJobs()).map((j) => ({
        taskId: j.taskId,
        status: j.status,
        userId: j.userId,
        mode: j.mode,
        prompt: j.prompt.slice(0, 80),
        createdAt: j.createdAt ? new Date(j.createdAt).toISOString() : "",
      }));
      reply.send({ jobs, pendingCount: await queue.pendingCount() });
    });
  };
}
