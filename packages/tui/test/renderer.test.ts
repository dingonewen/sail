import { describe, it, expect } from "vitest";
import { Renderer } from "../src/renderer.js";

describe("Renderer", () => {
  it("creates a Renderer instance", () => {
    const r = new Renderer();
    expect(r).toBeInstanceOf(Renderer);
  });

  it("writeChunk does not throw", () => {
    const r = new Renderer();
    expect(() => r.writeChunk("hello")).not.toThrow();
    expect(() => r.writeChunk("**bold**")).not.toThrow();
  });

  it("writeChunk handles markdown without throwing", () => {
    const r = new Renderer();
    const markdown = [
      "# Heading",
      "**bold** and `code` and *italic*",
      "- list item",
      "> blockquote",
      "```",
      "code block",
      "```",
      "| a | b |",
      "|---|---|",
      "| 1 | 2 |",
    ].join("\n");

    expect(() => r.writeChunk(markdown)).not.toThrow();
  });

  it("writeChunk handles empty string", () => {
    const r = new Renderer();
    expect(() => r.writeChunk("")).not.toThrow();
  });

  it("flush does not throw with empty buffer", () => {
    const r = new Renderer();
    expect(() => r.flush()).not.toThrow();
  });

  it("flush does not throw with partial content", () => {
    const r = new Renderer();
    r.writeChunk("partial line without newline");
    expect(() => r.flush()).not.toThrow();
  });

  it("showStepFinish does not throw", () => {
    const r = new Renderer();
    expect(() => r.showStepFinish("stop")).not.toThrow();
    expect(() => r.showStepFinish("tool-calls")).not.toThrow();
  });

  it("showDelegationStart/Complete do not throw", () => {
    const r = new Renderer();
    expect(() => r.showDelegationStart("code-reviewer", "review this file")).not.toThrow();
    expect(() => r.showDelegationComplete("code-reviewer", "3 issues found")).not.toThrow();
  });

  it("error does not throw", () => {
    const r = new Renderer();
    expect(() => r.error("something went wrong")).not.toThrow();
  });
});
