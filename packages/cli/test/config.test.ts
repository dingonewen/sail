import { describe, it, expect } from "vitest";
import { resolveProvider } from "../src/config.js";

describe("Config", () => {
  describe("resolveProvider", () => {
    it("returns CLI provider when given", () => {
      expect(resolveProvider("openai")).toBe("openai");
      expect(resolveProvider("deepseek", "anthropic/model")).toBe("deepseek");
    });

    it("extracts provider from CLI model string", () => {
      expect(resolveProvider(undefined, "openai/gpt-5.5")).toBe("openai");
      expect(resolveProvider(undefined, "deepseek/deepseek-chat")).toBe("deepseek");
    });

    it("CLI provider takes priority over CLI model", () => {
      expect(resolveProvider("anthropic", "openai/gpt-5.5")).toBe("anthropic");
    });
  });
});
