import { getAgent } from "./agent.js";

export type AgentMode = "chat" | "plan" | "build";

const MODE_INSTRUCTIONS: Record<AgentMode, string> = {
  chat:
    "You are in chat mode. Discuss the codebase, answer questions, and explore ideas. Do not make changes unless explicitly asked.",
  plan: "You are in plan mode. Analyze the codebase, design solutions, and write detailed plans. Do NOT modify any files. Write your plan as a structured document.",
  build:
    "You are in build mode. Execute the plan — make changes to files, run commands, and implement the solution. Report progress and verify results.",
};

/** Events emitted during agent streaming */
export interface StreamCallbacks {
  onTextChunk?: (chunk: string) => void;
  onToolCall?: (tool: { name: string; args: unknown }) => void;
  onToolResult?: (tool: { name: string; result: unknown }) => void;
  onStepFinish?: (step: { text: string; toolCalls: unknown[]; finishReason: string }) => void;
  onError?: (error: Error) => void;
}

/**
 * Controller that wraps the coding agent.
 * Uses Mastra's fullStream to capture tool calls, step events, and text.
 */
export class SailController {
  private currentMode: AgentMode = "chat";

  get mode(): AgentMode {
    return this.currentMode;
  }

  switchMode(mode: AgentMode): void {
    if (!MODE_INSTRUCTIONS[mode]) {
      throw new Error(`Unknown mode: ${mode}. Valid modes: chat, plan, build`);
    }
    this.currentMode = mode;
  }

  private buildPrompt(userPrompt: string): string {
    const modeInstructions = MODE_INSTRUCTIONS[this.currentMode];
    return `${modeInstructions}\n\n${userPrompt}`;
  }

  /** Run the agent in streaming mode — captures text + tool calls */
  async stream(
    prompt: string,
    options: {
      resource?: string;
      thread?: string;
      maxSteps?: number;
    } & StreamCallbacks = {}
  ) {
    const {
      resource = "default-user",
      thread,
      maxSteps = 25,
      onTextChunk,
      onToolCall,
      onToolResult,
      onStepFinish,
      onError,
    } = options;

    const fullPrompt = this.buildPrompt(prompt);
    const threadId = thread || `thread-${Date.now()}`;

    try {
      const agent = await getAgent();
      const stream = await agent.stream(fullPrompt, {
        memory: { resource, thread: threadId },
        maxSteps,
      });

      // Use fullStream to capture all event types
      for await (const event of stream.fullStream) {
        switch (event.type) {
          case "text-delta": {
            onTextChunk?.((event as any).textDelta ?? "");
            break;
          }
          case "tool-call": {
            onToolCall?.({
              name: (event as any).toolName ?? "unknown",
              args: (event as any).args ?? {},
            });
            break;
          }
          case "tool-result": {
            onToolResult?.({
              name: (event as any).toolName ?? "unknown",
              result: (event as any).result ?? {},
            });
            break;
          }
          case "step-finish": {
            onStepFinish?.({
              text: (event as any).text ?? "",
              toolCalls: (event as any).toolCalls ?? [],
              finishReason: (event as any).finishReason ?? "unknown",
            });
            break;
          }
          case "error": {
            const err = new Error((event as any).error ?? "Unknown stream error");
            onError?.(err);
            break;
          }
        }
      }

      // Drain textStream to ensure completion
      for await (const _ of stream.textStream) {
        // already consumed via fullStream
      }

      return await stream;
    } catch (error) {
      onError?.(error as Error);
      throw error;
    }
  }

  /** Run the agent in non-streaming mode (for -p flag) */
  async generate(
    prompt: string,
    options: {
      resource?: string;
      thread?: string;
      maxSteps?: number;
    } = {}
  ) {
    const {
      resource = "default-user",
      thread,
      maxSteps = 25,
    } = options;

    const fullPrompt = this.buildPrompt(prompt);
    const threadId = thread || `thread-${Date.now()}`;

    const agent = await getAgent();
    return agent.generate(fullPrompt, {
      memory: { resource, thread: threadId },
      maxSteps,
    });
  }
}
