import chalk from "chalk";

/**
 * Render a markdown line → terminal ANSI via chalk.
 */
function renderLine(line: string, _prevLine: string, nextLineIsTableSep: boolean): string {
  // ---- Code fence ----
  if (/^```/.test(line)) return chalk.dim(line);

  // ---- ATX headings ----
  const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const text = headingMatch[2];
    // Different colors per heading level
    const colors = [chalk.bold.yellow, chalk.bold.green, chalk.bold.cyan, chalk.bold.blue, chalk.bold.magenta, chalk.bold];
    return (colors[level - 1] || chalk.bold)(text);
  }

  // ---- Table rows ----
  if (/^\|.+\|$/.test(line)) {
    return renderTableRow(line, nextLineIsTableSep);
  }

  // ---- Ordered list ----
  const listMatch = line.match(/^(\s*)(\d+\.)\s+(.+)$/);
  if (listMatch) {
    return listMatch[1] + chalk.dim(listMatch[2]) + " " + renderInline(listMatch[3]);
  }

  // ---- Unordered list ----
  const ulMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
  if (ulMatch) {
    return ulMatch[1] + chalk.cyan("•") + " " + renderInline(ulMatch[2]);
  }

  // ---- Blockquote ----
  const bqMatch = line.match(/^>\s?(.+)$/);
  if (bqMatch) {
    return chalk.dim("│ ") + chalk.italic(renderInline(bqMatch[1]));
  }

  // ---- Horizontal rule ----
  if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line) && !/^\|/.test(line)) {
    return chalk.dim("─".repeat(40));
  }

  return renderInline(line);
}

/** Render a pipe-table row with alternating column colors */
function renderTableRow(line: string, isSeparatorRow: boolean): string {
  // Split by |, preserving leading/trailing pipes
  const cells = line.split("|");
  // Remove first and last empty elements from leading/trailing |
  const inner = cells.slice(1, -1);
  if (inner.length === 0) return chalk.dim(line);

  const rendered = inner.map((cell, i) => {
    const trimmed = cell.trim();
    if (isSeparatorRow) {
      // Separator: |------|:----|
      return chalk.dim(trimmed || "---");
    }
    // Alternating colors for readability
    const styled = renderInline(trimmed);
    return i % 2 === 0 ? styled : chalk.dim(styled);
  });

  return "│ " + rendered.join(chalk.dim(" │ ")) + " │";
}

/** Render inline formatting only (bold, code, italic, links, etc.) */
function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, (_, t) => chalk.bold(t))
    .replace(/__(.+?)__/g, (_, t) => chalk.bold(t))
    .replace(/~~(.+?)~~/g, (_, t) => chalk.strikethrough(t))
    .replace(/`([^`\n]+)`/g, (_, t) => chalk.yellow(t))
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, (_, t) => chalk.italic(t))
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) =>
      chalk.underline.blue(t) + chalk.dim(` (${u})`))
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt) => chalk.dim(`[img: ${alt || "image"}]`));
}

/**
 * Streaming markdown → terminal ANSI renderer.
 * State machine: tracks code fences across chunks.
 * Flushes line-by-line: each complete line is rendered immediately.
 */
export class Renderer {
  private buf = "";
  private inCodeBlock = false;

  writeChunk(chunk: string): void {
    this.buf += chunk;

    let nl = this.buf.indexOf("\n");
    while (nl >= 0) {
      const rawLine = this.buf.slice(0, nl);
      this.buf = this.buf.slice(nl + 1);

      // Code fence toggle
      if (rawLine.trimStart().startsWith("```")) {
        this.inCodeBlock = !this.inCodeBlock;
        process.stdout.write(chalk.dim(rawLine) + "\n");
      } else if (this.inCodeBlock) {
        process.stdout.write(chalk.dim(rawLine) + "\n");
      } else {
        // Peek next line for table context
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
        process.stdout.write(chalk.dim(this.buf));
      } else {
        process.stdout.write(renderLine(this.buf, "", false));
      }
      this.buf = "";
    }
  }

  showStepFinish(reason: string): void {
    this.flush();
    if (reason !== "stop" && reason !== "end-turn" && reason !== "?") {
      process.stdout.write(chalk.dim(` [${reason}]`));
    }
  }

  error(message: string): void {
    this.flush();
    process.stderr.write(chalk.red(`\n  Error: ${message}\n`));
  }
}
