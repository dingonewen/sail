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
  onStepFinish?: (reason: string) => void;
  onFinish?: () => void;
  onError?: (error: Error) => void;
}

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

  private defaultMaxSteps(): number {
    return this.currentMode === "chat" ? 10 : this.currentMode === "plan" ? 15 : 25;
  }

  private buildPrompt(userPrompt: string): string {
    const modeInstructions = MODE_INSTRUCTIONS[this.currentMode];
    return `${modeInstructions}\n\n${userPrompt}`;
  }

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
      maxSteps = this.defaultMaxSteps(),
      onTextChunk,
      onStepFinish,
      onFinish,
      onError,
    } = options;

    const fullPrompt = this.buildPrompt(prompt);
    const threadId = thread || `thread-${Date.now()}`;

    try {
      const agent = await getAgent();
      const stream = await agent.stream(fullPrompt, {
        memory: { resource, thread: threadId },
        maxSteps,
        onStepFinish: (step: any) => {
          const reason = step?.finishReason ?? step?.stepResult?.reason ?? "?";
          onStepFinish?.(reason);
        },
      });

      // textStream is the AI SDK native text stream — proven to work
      for await (const chunk of stream.textStream) {
        onTextChunk?.(chunk);
      }

      onFinish?.();
      return await stream;
    } catch (error) {
      onError?.(error as Error);
      throw error;
    }
  }

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
      maxSteps = this.defaultMaxSteps(),
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
