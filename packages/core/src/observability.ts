import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";

type ObsMode = "off" | "console" | "file" | "both";

let _mode: ObsMode | null = null;

function mode(): ObsMode {
  if (_mode) return _mode;
  const v = process.env.SAIL_OBSERVABILITY;
  if (v === "console" || v === "1" || v === "true") _mode = "console";
  else if (v === "file" || v === "json") _mode = "file";
  else if (v === "both") _mode = "both";
  else _mode = "off";
  return _mode;
}

export function setObservabilityMode(m: ObsMode): void {
  _mode = m;
}

export function getObservabilityMode(): ObsMode {
  return mode();
}

function logPath(): string {
  return `${homedir()}/.sail/observability.jsonl`;
}

export function getObservabilityLogPath(): string {
  return logPath();
}

function ensureDir(): void {
  const dir = dirname(logPath());
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function emit(type: string, data: Record<string, unknown>): void {
  const m = mode();
  if (m === "off") return;
  const ts = new Date().toISOString();
  if (m === "console" || m === "both") {
    const icon =
      type === "tool_call" ? "🔧" :
      type === "model_turn" ? "🤖" :
      type === "delegation" ? "🔀" : "❌";
    process.stdout.write(`\n  ${icon} [${ts.slice(11, 23)}] ${type} ${JSON.stringify(data)}`);
  }
  if (m === "file" || m === "both") {
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

// ── OTLP tracing (OpenTelemetry-compatible, opt-in) ──

function hex16(): string {
  return randomBytes(8).toString("hex");
}

function hex32(): string {
  return randomBytes(16).toString("hex");
}

function nanoTime(): string {
  return (BigInt(Date.now()) * 1_000_000n).toString();
}

let _traceId: string | null = null;

function getTraceId(): string {
  if (!_traceId) _traceId = hex32();
  return _traceId;
}

let _activeParentSpanId: string | null = null;

interface OtlpAttribute {
  key: string;
  value: { stringValue?: string; intValue?: number; boolValue?: boolean };
}

interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpAttribute[];
  status: { code: number };
}

const _spanBuffer: OtlpSpan[] = [];

function addSpan(span: OtlpSpan): void {
  _spanBuffer.push(span);
}

function attr(key: string, value: string | number | boolean): OtlpAttribute {
  if (typeof value === "string") return { key, value: { stringValue: value } };
  if (typeof value === "number") return { key, value: { intValue: value } };
  return { key, value: { boolValue: value } };
}

let _started = false;

function ensureOtlpStarted(): boolean {
  if (!process.env.SAIL_OTLP_ENDPOINT) return false;
  if (_started) return true;
  _started = true;

  // Flush on normal exit
  process.on("beforeExit", async () => {
    await flushOtlp();
  });

  // Flush on SIGINT/SIGTERM — don't force exit, let beforeExit handle it
  let _sigReceived = false;
  const onSignal = () => {
    if (_sigReceived) process.exit(1); // double-tap = force quit
    _sigReceived = true;
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  return true;
}

function emitOtlpSpan(
  name: string,
  kind: number,
  startTimeUnixNano: string,
  endTimeUnixNano: string,
  attributes: OtlpAttribute[],
  parentSpanId?: string,
): void {
  if (!ensureOtlpStarted()) return;

  const spanId = hex16();
  const span: OtlpSpan = {
    traceId: getTraceId(),
    spanId,
    name,
    kind,
    startTimeUnixNano,
    endTimeUnixNano,
    attributes: [
      attr("service.name", "sail"),
      ...attributes,
    ],
    status: { code: 1 }, // OK
  };
  if (parentSpanId || _activeParentSpanId) {
    span.parentSpanId = parentSpanId ?? _activeParentSpanId ?? undefined;
  }
  addSpan(span);
}

async function flushOtlp(): Promise<void> {
  if (_spanBuffer.length === 0) return;
  const endpoint = process.env.SAIL_OTLP_ENDPOINT!;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const headerEnv = process.env.SAIL_OTLP_HEADERS;
  if (headerEnv) {
    for (const pair of headerEnv.split(",")) {
      const [k, v] = pair.split("=");
      if (k && v) headers[k.trim()] = v.trim();
    }
  }

  const body = JSON.stringify({
    resourceSpans: [{
      resource: {
        attributes: [attr("service.name", "sail")],
      },
      scopeSpans: [{
        scope: { name: "sail" },
        spans: _spanBuffer.splice(0),
      }],
    }],
  });

  try {
    await fetch(endpoint, { method: "POST", headers, body, signal: AbortSignal.timeout(10000) });
  } catch {
    // Fire-and-forget: don't block the agent on observability failures
  }
}
// ── Public API ──

/** Record a tool call */
export function recordToolCall(
  name: string, args: unknown, result: unknown, durationMs: number, approved?: boolean,
): void {
  emit("tool_call", { tool: name, args: summarize(args), result: summarize(result), durationMs, approved });

  const now = nanoTime();
  const start = (BigInt(now) - BigInt(durationMs) * 1_000_000n).toString();
  emitOtlpSpan(`tool_call: ${name}`, 3 /* CLIENT */, start, now, [
    attr("tool.name", name),
    attr("tool.duration_ms", durationMs),
    attr("tool.approved", approved ?? false),
  ]);
}

/** Record an LLM inference step */
export function recordModelTurn(
  finishReason: string, textLen: number, tokens?: { input?: number; output?: number }, durationMs?: number,
): void {
  emit("model_turn", { finishReason, textLen, tokens, durationMs });

  const now = nanoTime();
  const start = durationMs
    ? (BigInt(now) - BigInt(durationMs) * 1_000_000n).toString()
    : now;
  const parentId = hex16();
  _activeParentSpanId = parentId;
  emitOtlpSpan(`model_turn`, 1 /* INTERNAL */, start, now, [
    attr("gen_ai.operation.name", "chat"),
    attr("gen_ai.response.finish_reason", finishReason),
    attr("gen_ai.usage.input_tokens", tokens?.input ?? 0),
    attr("gen_ai.usage.output_tokens", tokens?.output ?? 0),
    attr("gen_ai.output.text_length", textLen),
  ]);
}

/** Record subagent delegation */
export function recordDelegation(agent: string, dir: "start" | "complete", preview: string): void {
  emit("delegation", { agent, direction: dir, preview });

  emitOtlpSpan(
    `delegation.${dir}: ${agent}`,
    dir === "start" ? 1 /* INTERNAL */ : 2 /* SERVER */,
    nanoTime(),
    nanoTime(),
    [attr("subagent.name", agent), attr("subagent.preview", preview.slice(0, 200))],
  );
}

/** Record an error */
export function recordError(msg: string): void {
  emit("error", { message: msg });

  const now = nanoTime();
  emitOtlpSpan("error", 1 /* INTERNAL */, now, now, [
    attr("error.message", msg),
  ]);
}

/** Manually flush OTLP spans. Called by the CLI before exit. */
export async function flushObservability(): Promise<void> {
  await flushOtlp();
}
