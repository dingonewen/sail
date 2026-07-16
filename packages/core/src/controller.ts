import { getAgent } from "./agent.js";
import { recordToolCall, recordModelTurn, recordDelegation, recordError, flushObservability } from "./observability.js";

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
  /** Supervisor is about to delegate to a subagent */
  onDelegationStart?: (agent: string, prompt: string) => void;
  /** Subagent finished and returned results */
  onDelegationComplete?: (agent: string, resultPreview: string) => void;
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
      onDelegationStart,
      onDelegationComplete,
      onStepFinish,
      onFinish,
      onError,
    } = options;

    const fullPrompt = this.buildPrompt(prompt);
    const threadId = thread || `thread-${Date.now()}`;
    const t0 = Date.now();
    let textLen = 0;

    try {
      const agent = await getAgent();   // get supervisor
      const mastraStream = await agent.stream(fullPrompt, {
        untilIdle: true,
        memory: { resource, thread: threadId },
        maxSteps,
        toolCallConcurrency: 5,
        requireToolApproval: this.autoApprove || this.autoDeny
          ? undefined
          : async (ctx) => {
              if (!DANGEROUS_TOOLS.has(ctx.toolName)) return false;
              if (!onApprovalRequired) return false;
              const t = Date.now();
              const approved = await onApprovalRequired({
                name: ctx.toolName,
                args: ctx.args ?? {},
              });
              recordToolCall(ctx.toolName, ctx.args, approved ? "approved" : "denied", Date.now() - t, approved);
              if (!approved) {
                throw new Error(`User denied tool call: ${ctx.toolName}`);
              }
              return false;
            },
        delegation: onDelegationStart || onDelegationComplete ? {
          onDelegationStart: async (ctx: any) => {
            onDelegationStart?.(ctx.primitiveId ?? "unknown", ctx.prompt ?? "");
            recordDelegation(ctx.primitiveId ?? "?", "start", ctx.prompt ?? "");
            return { proceed: true };
          },
          onDelegationComplete: async (ctx: any) => {
            const preview = typeof ctx.result === "string"
              ? ctx.result
              : JSON.stringify(ctx.result);
            onDelegationComplete?.(ctx.primitiveId ?? "unknown", preview);
            recordDelegation(ctx.primitiveId ?? "?", "complete", preview);
            if (ctx.error) {
              return { feedback: `${ctx.primitiveId} failed: ${ctx.error}` };
            }
          },
        } : undefined,
        onStepFinish: (step: any) => {
          const reason = step?.finishReason ?? step?.stepResult?.reason ?? "?";
          onStepFinish?.(reason);
          recordModelTurn(reason, textLen, step?.usage ? {
            input: step.usage.inputTokens,
            output: step.usage.outputTokens,
          } : undefined, Date.now() - t0);

          // Record all tool calls from this step
          for (const tc of step?.toolCalls ?? []) {
            const p = tc.payload ?? tc;
            recordToolCall(p.toolName ?? "?", p.args ?? {}, p.output ?? "ok", 0);
          }
          for (const tr of step?.toolResults ?? []) {
            const p = tr.payload ?? tr;
            recordToolCall(p.toolName ?? "?", p.args ?? {}, p.result ?? "ok", 0);
          }
        },
      });

      for await (const chunk of mastraStream.textStream) {
        textLen += chunk.length;
        onTextChunk?.(chunk);
      }

      onFinish?.();
      return await mastraStream;
    } catch (error) {
      recordError((error as Error).message);
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
    const t0 = Date.now();

    const agent = await getAgent();
    const result = await agent.generate(fullPrompt, {
      memory: { resource, thread: threadId },
      maxSteps,
    });

    const usage = (result as any).usage;
    recordModelTurn(
      result.finishReason ?? "stop",
      result.text?.length ?? 0,
      usage ? { input: usage.promptTokens ?? usage.inputTokens ?? 0, output: usage.completionTokens ?? usage.outputTokens ?? 0 } : undefined,
      Date.now() - t0,
    );
    await flushObservability();

    return result;
  }
}
