import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { readdir, stat, readFile } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { cwd } from "node:process";

export const searchTool = createTool({
  id: "search",
  description:
    "Search for a text pattern in files. Supports grep-style regex search with directory traversal.",
  inputSchema: z.object({
    pattern: z.string().describe("The regex pattern to search for"),
    path: z
      .string()
      .optional()
      .describe(
        "Directory or file to search in. Defaults to current working directory."
      ),
    fileGlob: z
      .string()
      .optional()
      .describe('File pattern to filter, e.g. "*.ts" or "*.md"'),
    maxResults: z
      .number()
      .int()
      .positive()
      .default(50)
      .describe("Maximum number of results to return"),
  }),
  execute: async ({ pattern, path, fileGlob, maxResults }) => {
    const searchRoot = path ? resolve(path) : cwd();
    const regex = new RegExp(pattern, "g");
    const results: Array<{
      file: string;
      line: number;
      content: string;
    }> = [];

    async function searchDir(dir: string) {
      if (results.length >= maxResults) return;
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxResults) return;
        const fullPath = join(dir, entry.name);

        // Skip common dirs
        if (
          entry.isDirectory() &&
          !["node_modules", ".git", "dist", ".next"].includes(entry.name)
        ) {
          await searchDir(fullPath);
          continue;
        }

        if (!entry.isFile()) continue;
        if (fileGlob && !matchGlob(entry.name, fileGlob)) continue;

        try {
          const fileStat = await stat(fullPath);
          if (fileStat.size > 1024 * 1024) continue; // Skip files > 1MB

          const rl = createInterface({
            input: createReadStream(fullPath, { encoding: "utf-8" }),
            crlfDelay: Infinity,
          });

          let lineNum = 0;
          for await (const line of rl) {
            lineNum++;
            if (regex.test(line)) {
              results.push({
                file: relative(searchRoot, fullPath),
                line: lineNum,
                content: line.trim().slice(0, 200),
              });
              if (results.length >= maxResults) break;
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
    }

    await searchDir(searchRoot);

    return {
      pattern,
      results,
      count: results.length,
      truncated: results.length >= maxResults,
    };
  },
});

function matchGlob(filename: string, glob: string): boolean {
  const regex = new RegExp(
    "^" + glob.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
  );
  return regex.test(filename);
}
