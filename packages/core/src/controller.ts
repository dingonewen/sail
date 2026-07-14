import { getAgent } from "./agent.js";

export type AgentMode = "chat" | "plan" | "build";

/** Tools that should always require user approval */
const DANGEROUS_TOOLS = new Set([
  "mastra_workspace_write_file",
  "mastra_workspace_edit_file",
  "mastra_workspace_delete",
  "mastra_workspace_execute_command",
]);

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
  /** User must approve or deny a dangerous tool call before it executes */
  onApprovalRequired?: (
    tool: { name: string; args: unknown },
  ) => Promise<boolean>;
  onStepFinish?: (reason: string) => void;
  onFinish?: () => void;
  onError?: (error: Error) => void;
}

export class SailController {
  private currentMode: AgentMode = "chat";
  private autoApprove = false;
  private autoDeny = false;

  get mode(): AgentMode {
    return this.currentMode;
  }

  switchMode(mode: AgentMode): void {
    if (!MODE_INSTRUCTIONS[mode]) {
      throw new Error(`Unknown mode: ${mode}. Valid modes: chat, plan, build`);
    }
    this.currentMode = mode;
  }

  /** Auto-approve all dangerous tools (--approve flag) */
  setAutoApprove(enabled: boolean): void {
    this.autoApprove = enabled;
  }

  /** Auto-deny all dangerous tools (--no-approve flag) */
  setAutoDeny(enabled: boolean): void {
    this.autoDeny = enabled;
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
      onApprovalRequired,
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
        requireToolApproval: this.autoApprove || this.autoDeny
          ? undefined
          : async (ctx) => {
              // Only require approval for dangerous tools
              if (!DANGEROUS_TOOLS.has(ctx.toolName)) return false;
              if (!onApprovalRequired) return false;
              const approved = await onApprovalRequired({
                name: ctx.toolName,
                args: ctx.args ?? {},
              });
              if (!approved) {
                throw new Error(`User denied tool call: ${ctx.toolName}`);
              }
              return false; // We handled approval ourselves, don't double-pause
            },
        onStepFinish: (step: any) => {
          const reason = step?.finishReason ?? step?.stepResult?.reason ?? "?";
          onStepFinish?.(reason);
        },
      });

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
