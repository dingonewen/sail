import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const readFileTool = createTool({
  id: "read-file",
  description: "Read the contents of a file. Supports reading a range of lines.",
  inputSchema: z.object({
    path: z.string().describe("Absolute or relative path to the file to read"),
    startLine: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Starting line number (1-indexed, inclusive)"),
    endLine: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Ending line number (1-indexed, inclusive)"),
  }),
  execute: async ({ path, startLine, endLine }) => {
    const resolved = resolve(path);
    const content = await readFile(resolved, "utf-8");
    const lines = content.split("\n");

    const start = startLine ? startLine - 1 : 0;
    const end = endLine ? endLine : lines.length;
    const selected = lines.slice(start, end);

    const result = selected.join("\n");
    return {
      content: result,
      path: resolved,
      totalLines: lines.length,
      startLine: start + 1,
      endLine: Math.min(end, lines.length),
    };
  },
});
