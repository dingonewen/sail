import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { mkdir } from "node:fs/promises";

export const writeFileTool = createTool({
  id: "write-file",
  description:
    "Create a new file or overwrite an existing file with the given content.",
  requireApproval: true,
  inputSchema: z.object({
    path: z.string().describe("Absolute or relative path to the file to write"),
    content: z.string().describe("The content to write to the file"),
  }),
  execute: async ({ path, content }) => {
    const resolved = resolve(path);
    await mkdir(dirname(resolved), { recursive: true });
    await writeFile(resolved, content, "utf-8");
    return {
      path: resolved,
      size: Buffer.byteLength(content, "utf-8"),
      written: true,
    };
  },
});
