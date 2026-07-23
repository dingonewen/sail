import { describe, it, expect } from "vitest";
import { buildServer } from "../src/server.js";

describe("@sail/api", () => {
  it("buildServer constructs a Fastify instance with all routes", async () => {
    const app = await buildServer();
    expect(app).toBeDefined();
    expect(typeof app.ready).toBe("function");

    // Health check returns 200
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);

    // Swagger docs available
    const docs = await app.inject({ method: "GET", url: "/docs" });
    expect(docs.statusCode).toBe(200);

    await app.close();
  });
});
