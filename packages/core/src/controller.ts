import { codingAgent } from "./agent.js";

export type AgentMode = "chat" | "plan" | "build";

const MODE_INSTRUCTIONS: Record<AgentMode, string> = {
  chat:
    "You are in chat mode. Discuss the codebase, answer questions, and explore ideas. Do not make changes unless explicitly asked.",
  plan: "You are in plan mode. Analyze the codebase, design solutions, and write detailed plans. Do NOT modify any files. Write your plan as a structured document.",
  build:
    "You are in build mode. Execute the plan — make changes to files, run commands, and implement the solution. Report progress and verify results.",
};

/**
 * Simple controller that wraps the coding agent.
 * Handles mode switching and stream execution.
 * Uses Mastra's native Agent for the agent loop.
 */
export class SailController {
  private currentMode: AgentMode = "chat";

  /** Get the current mode */
  get mode(): AgentMode {
    return this.currentMode;
  }

  /** Switch the agent mode */
  switchMode(mode: AgentMode): void {
    if (!MODE_INSTRUCTIONS[mode]) {
      throw new Error(`Unknown mode: ${mode}. Valid modes: chat, plan, build`);
    }
    this.currentMode = mode;
  }

  /** Build the full prompt with mode instructions */
  private buildPrompt(userPrompt: string): string {
    const modeInstructions = MODE_INSTRUCTIONS[this.currentMode];
    return `${modeInstructions}\n\n${userPrompt}`;
  }

  /** Run the agent in streaming mode with token-by-token output */
  async stream(
    prompt: string,
    options: {
      resource?: string;
      thread?: string;
      maxSteps?: number;
      onTextChunk?: (chunk: string) => void;
      onError?: (error: Error) => void;
    } = {}
  ) {
    const {
      resource = "default-user",
      thread,
      maxSteps = 25,
      onTextChunk,
      onError,
    } = options;

    const fullPrompt = this.buildPrompt(prompt);
    const threadId = thread || `thread-${Date.now()}`;

    try {
      const stream = await codingAgent.stream(fullPrompt, {
        memory: { resource, thread: threadId },
        maxSteps,
      });

      for await (const chunk of stream.textStream) {
        onTextChunk?.(chunk);
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

    return codingAgent.generate(fullPrompt, {
      memory: { resource, thread: threadId },
      maxSteps,
    });
  }
}
