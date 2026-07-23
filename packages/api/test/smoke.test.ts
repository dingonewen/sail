import { describe, it, expect } from "vitest";
import { JobQueue } from "../src/queue.js";

describe("@sail/api", () => {
  it("JobQueue can be constructed without Redis", () => {
    const queue = new JobQueue();
    expect(queue).toBeDefined();
    expect(typeof queue.enqueue).toBe("function");
    expect(typeof queue.getJob).toBe("function");
    expect(typeof queue.listJobs).toBe("function");
  });
});
