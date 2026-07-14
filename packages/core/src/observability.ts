import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";

type ObsMode = "off" | "console" | "file";

let _mode: ObsMode | null = null;

function mode(): ObsMode {
  if (_mode) return _mode;
  const v = process.env.SAIL_OBSERVABILITY;
  if (v === "console" || v === "1" || v === "true") _mode = "console";
  else if (v === "file" || v === "json") _mode = "file";
  else _mode = "off";
  return _mode;
}

function logPath(): string {
  return `${homedir()}/.sail/observability.jsonl`;
}

function ensureDir(): void {
  const dir = dirname(logPath());
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function emit(type: string, data: Record<string, unknown>): void {
  const m = mode();
  if (m === "off") return;
  const ts = new Date().toISOString();
  if (m === "console") {
    const icon =
      type === "tool_call" ? "🔧" :
      type === "model_turn" ? "🤖" :
      type === "delegation" ? "🔀" : "❌";
    process.stdout.write(`\n  ${icon} [${ts.slice(11, 23)}] ${type} ${JSON.stringify(data)}`);
  }
  if (m === "file") {
    ensureDir();
    appendFileSync(logPath(), JSON.stringify({ ts, type, data }) + "\n", "utf-8");
  }
}

function summarize(v: unknown): unknown {
  if (typeof v === "string") return v.slice(0, 200);
  if (typeof v === "object" && v !== null) {
    if (Array.isArray(v)) return v.slice(0, 5).map(summarize);
    const r: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      r[k] = summarize(val);
      if (Object.keys(r).length > 10) break;
    }
    return r;
  }
  return v;
}

/** Record a tool call */
export function recordToolCall(
  name: string, args: unknown, result: unknown, durationMs: number, approved?: boolean,
): void {
  emit("tool_call", { tool: name, args: summarize(args), result: summarize(result), durationMs, approved });
}

/** Record an LLM inference step */
export function recordModelTurn(
  finishReason: string, textLen: number, tokens?: { input?: number; output?: number }, durationMs?: number,
): void {
  emit("model_turn", { finishReason, textLen, tokens, durationMs });
}

/** Record subagent delegation */
export function recordDelegation(agent: string, dir: "start" | "complete", preview: string): void {
  emit("delegation", { agent, direction: dir, preview });
}

/** Record an error */
export function recordError(msg: string): void {
  emit("error", { message: msg });
}
