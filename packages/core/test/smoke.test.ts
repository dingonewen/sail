import { describe, it, expect } from "vitest";

describe("@sail/core", () => {
  it("exports all public symbols without throwing", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.getAgent).toBe("function");
    expect(typeof mod.SailController).toBe("function");
    expect(typeof mod.createMemory).toBe("function");
    expect(typeof mod.createSailWorkspace).toBe("function");
    expect(typeof mod.createSubagents).toBe("function");
    expect(typeof mod.recordToolCall).toBe("function");
    expect(typeof mod.recordModelTurn).toBe("function");
    expect(typeof mod.setObservabilityMode).toBe("function");
    expect(typeof mod.getObservabilityMode).toBe("function");
    expect(typeof mod.getObservabilityLogPath).toBe("function");
  });
});
