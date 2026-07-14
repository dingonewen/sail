import chalk from "chalk";

// Catppuccin Latte palette
const c = {
  pink: chalk.hex("#ea76cb"),
  mauve: chalk.hex("#8839ef"),
  red: chalk.hex("#d20f39"),
  peach: chalk.hex("#fe640b"),
  yellow: chalk.hex("#df8e1d"),
  green: chalk.hex("#40a02b"),
  teal: chalk.hex("#179299"),
  sky: chalk.hex("#04a5e5"),
  sapphire: chalk.hex("#209fb5"),
  blue: chalk.hex("#1e66f5"),
  lavender: chalk.hex("#7287fd"),
  rosewater: chalk.hex("#dc8a78"),
  flamingo: chalk.hex("#dd7878"),
  text: chalk.hex("#4c4f69"),
  subtext0: chalk.hex("#6c6f85"),
  surface0: chalk.hex("#ccd0da"),
  mantle: chalk.hex("#e6e9ef"),
};

const dim = c.subtext0;
const headingColors = [c.pink.bold, c.mauve.bold, c.blue.bold, c.teal.bold, c.peach.bold, c.lavender.bold];

/**
 * Render a markdown line → terminal ANSI via chalk.
 */
function renderLine(line: string, _prevLine: string, nextLineIsTableSep: boolean): string {
  if (/^```/.test(line)) return dim(line);

  const h = line.match(/^(#{1,6})\s+(.+)$/);
  if (h) return (headingColors[h[1].length - 1] || chalk.bold)(h[2]);

  if (/^\|.+\|$/.test(line)) return renderTableRow(line, nextLineIsTableSep);

  const ol = line.match(/^(\s*)(\d+\.)\s+(.+)$/);
  if (ol) return ol[1] + dim(ol[2]) + " " + renderInline(ol[3]);

  const ul = line.match(/^(\s*)[-*]\s+(.+)$/);
  if (ul) return ul[1] + c.teal("•") + " " + renderInline(ul[2]);

  const bq = line.match(/^>\s?(.+)$/);
  if (bq) return dim("│ ") + c.surface0.italic(renderInline(bq[1]));

  if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line) && !/^\|/.test(line))
    return dim("─".repeat(40));

  return renderInline(line);
}

function extractText(raw: string): string {
  try {
    const obj = JSON.parse(raw);
    if (typeof obj.text === "string") return obj.text;
  } catch {}
  return raw;
}

function renderTableRow(line: string, isSep: boolean): string {
  const inner = line.split("|").slice(1, -1);
  if (!inner.length) return dim(line);
  const cols = inner.map((cell, i) => {
    const t = cell.trim();
    if (isSep) return dim(t || "---");
    const styled = renderInline(t);
    return i % 2 === 0 ? styled : c.surface0(styled);
  });
  return "│ " + cols.join(dim(" │ ")) + " │";
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, (_, t) => chalk.bold(t))
    .replace(/__(.+?)__/g, (_, t) => chalk.bold(t))
    .replace(/~~(.+?)~~/g, (_, t) => c.red.strikethrough(t))
    .replace(/`([^`\n]+)`/g, (_, t) => c.peach(t))
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, (_, t) => c.sky.italic(t))
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) =>
      c.blue.underline(t) + dim(` (${u})`))
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt) => dim(`[img: ${alt || "image"}]`));
}

/**
 * Streaming markdown → terminal ANSI renderer.
 * State machine: tracks code fences across chunks.
 * Flushes line-by-line: each complete line is rendered immediately.
 */
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Renderer {
  private buf = "";
  private inCodeBlock = false;
  private spinnerIdx = 0;
  private spinnerActive = false;
  private spinnerTimer: NodeJS.Timeout | null = null;
  private lastActivity = 0;

  /** Start the thinking spinner (public for external restart) */
  startSpinner(): void {
    if (this.spinnerActive) return;
    this.spinnerActive = true;
    // Show initial spinner
    process.stdout.write(c.subtext0(SPINNER[0]));
    this.lastActivity = Date.now();
    this.spinnerTimer = setInterval(() => {
      if (!this.spinnerActive) return;
      // Clear spinner if nothing happened for a while
      this.spinnerIdx = (this.spinnerIdx + 1) % SPINNER.length;
      process.stdout.write("\r" + c.subtext0(SPINNER[this.spinnerIdx]) + " ");
    }, 80);
  }

  /** Stop the spinner (public for external control) */
  stopSpinner(): void {
    if (!this.spinnerActive) return;
    this.spinnerActive = false;
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
    }
    // Clear the spinner from the line
    process.stdout.write("\r\x1b[K");
  }

  writeChunk(chunk: string): void {
    this.stopSpinner();
    this.buf += chunk;

    let nl = this.buf.indexOf("\n");
    while (nl >= 0) {
      const rawLine = this.buf.slice(0, nl);
      this.buf = this.buf.slice(nl + 1);

      if (rawLine.trimStart().startsWith("```")) {
        this.inCodeBlock = !this.inCodeBlock;
        process.stdout.write(c.surface0(rawLine) + "\n");
      } else if (this.inCodeBlock) {
        process.stdout.write(c.surface0(rawLine) + "\n");
      } else {
        const nextNl = this.buf.indexOf("\n");
        const nextLine = nextNl >= 0 ? this.buf.slice(0, nextNl) : "";
        const nextIsSep = /^\|[\s\-:|]+\|$/.test(nextLine);
        process.stdout.write(renderLine(rawLine, "", nextIsSep) + "\n");
      }

      nl = this.buf.indexOf("\n");
    }
  }

  /** Flush remaining buffer (incomplete last line) */
  flush(): void {
    if (this.buf.length > 0) {
      if (this.inCodeBlock) {
        process.stdout.write(c.surface0(this.buf));
      } else {
        process.stdout.write(renderLine(this.buf, "", false));
      }
      this.buf = "";
    }
  }

  showDelegationStart(agent: string, prompt: string): void {
    this.stopSpinner();
    this.flush();
    const names: Record<string, string> = { "code-reviewer": "reviewer", "code-explorer": "explorer", "code-fixer": "fixer" };
    const short = names[agent] || agent;
    process.stdout.write(c.rosewater(`\n  → ${short}: ${prompt}\n`));
    this.startSpinner();
  }

  showDelegationComplete(agent: string, preview: string): void {
    this.stopSpinner();
    const names: Record<string, string> = { "code-reviewer": "reviewer", "code-explorer": "explorer", "code-fixer": "fixer" };
    const short = names[agent] || agent;
    const text = extractText(preview);
    process.stdout.write(c.green(`  ← ${short}: ${text}\n`));
    this.startSpinner();
  }

  showStepFinish(reason: string): void {
    this.stopSpinner();
    this.flush();
    if (reason === "error") process.stdout.write(c.red(` [error]`));
    else if (reason === "length") process.stdout.write(c.peach(` [truncated]`));
  }

  error(message: string): void {
    this.stopSpinner();
    this.flush();
    process.stderr.write(c.red(`\n  Error: ${message}\n`));
  }
}
