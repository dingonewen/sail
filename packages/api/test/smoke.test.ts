import { describe, it, expect } from "vitest";
import { JobQueue } from "../src/queue.js";
import { buildServer } from "../src/server.js";

describe("@sail/api", () => {
  it("JobQueue enqueues and retrieves jobs", () => {
    const queue = new JobQueue();
    const job = queue.enqueue({ prompt: "hello", userId: "u1" });

    expect(job.taskId).toBeDefined();
    expect(job.status).toBe("queued");
    expect(job.prompt).toBe("hello");
    expect(job.userId).toBe("u1");

    const found = queue.getJob(job.taskId);
    expect(found).toBeDefined();
    expect(found!.taskId).toBe(job.taskId);
  });

  it("JobQueue dequeues in FIFO order", () => {
    const queue = new JobQueue();
    const a = queue.enqueue({ prompt: "first" });
    const b = queue.enqueue({ prompt: "second" });

    const first = queue.dequeue();
    expect(first!.taskId).toBe(a.taskId);
    expect(first!.status).toBe("running");

    // Second dequeue returns undefined while first is still processing
    const second = queue.dequeue();
    expect(second).toBeUndefined();

    // Complete first job, then second can be dequeued
    queue.updateJob(a.taskId, { status: "done", result: "ok" });
    const third = queue.dequeue();
    expect(third!.taskId).toBe(b.taskId);
  });

  it("JobQueue returns undefined on empty queue", () => {
    const queue = new JobQueue();
    expect(queue.dequeue()).toBeUndefined();
  });

  it("buildServer constructs a Fastify instance", async () => {
    const app = await buildServer();
    expect(app).toBeDefined();
    expect(typeof app.ready).toBe("function");

    // Health check returns 200
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");

    await app.close();
  });

  it("POST /chat returns 201 with a taskId", async () => {
    const app = await buildServer();

    const res = await app.inject({
      method: "POST",
      url: "/chat",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "test message" }),
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.taskId).toBeDefined();
    expect(body.status).toBe("queued");

    await app.close();
  });

  it("GET /chat/:taskId returns 404 for unknown task", async () => {
    const app = await buildServer();

    const res = await app.inject({ method: "GET", url: "/chat/nonexistent" });
    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
