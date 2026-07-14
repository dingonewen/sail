import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const editFileTool = createTool({
  id: "edit-file",
  description:
    "Edit a file by replacing an exact string with a new string. The old string must match exactly once in the file.",
  requireApproval: true,
  inputSchema: z.object({
    path: z.string().describe("Absolute or relative path to the file to edit"),
    oldString: z.string().describe("The exact string to find and replace"),
    newString: z.string().describe("The string to replace it with"),
  }),
  execute: async ({ path, oldString, newString }) => {
    const resolved = resolve(path);
    const content = await readFile(resolved, "utf-8");

    const occurrences = content.split(oldString).length - 1;
    if (occurrences === 0) {
      return {
        success: false,
        error: `String not found in file: "${oldString.slice(0, 100)}"`,
        path: resolved,
      };
    }

    if (occurrences > 1) {
      return {
        success: false,
        error: `Found ${occurrences} occurrences of the string. Please provide a more specific string that matches exactly once.`,
        path: resolved,
        occurrences,
      };
    }

    const newContent = content.replace(oldString, newString);
    await writeFile(resolved, newContent, "utf-8");

    return {
      success: true,
      path: resolved,
      replaced: oldString,
      with: newString,
      linesChanged: newContent.split("\n").length - content.split("\n").length,
    };
  },
});
