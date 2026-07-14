import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { readdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";

export const listDirTool = createTool({
  id: "list-dir",
  description: "List the contents of a directory.",
  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .describe(
        "Directory path to list. Defaults to current working directory."
      ),
    recursive: z
      .boolean()
      .default(false)
      .describe("Whether to list contents recursively"),
    maxDepth: z
      .number()
      .int()
      .positive()
      .max(5)
      .default(2)
      .describe("Maximum recursion depth (default 2, max 5)"),
  }),
  execute: async ({ path, recursive, maxDepth }) => {
    const target = path ? resolve(path) : process.cwd();

    async function listDir(
      dir: string,
      currentDepth: number
    ): Promise<
      Array<{
        name: string;
        path: string;
        type: "file" | "directory";
        size?: number;
      }>
    > {
      const entries = await readdir(dir, { withFileTypes: true });
      const results: Array<{
        name: string;
        path: string;
        type: "file" | "directory";
        size?: number;
      }> = [];

      for (const entry of entries) {
        // Skip hidden files/dirs and node_modules by default
        if (
          entry.name.startsWith(".") &&
          entry.name !== ".env.example"
        )
          continue;
        if (entry.name === "node_modules") continue;

        const fullPath = join(dir, entry.name);
        const relativePath = fullPath.replace(target, "").replace(/^\//, "");

        if (entry.isDirectory()) {
          results.push({
            name: entry.name,
            path: relativePath,
            type: "directory" as const,
          });

          if (recursive && currentDepth < maxDepth) {
            try {
              const children = await listDir(fullPath, currentDepth + 1);
              results.push(...children);
            } catch {
              // Skip dirs we can't read
            }
          }
        } else if (entry.isFile()) {
          try {
            const info = await stat(fullPath);
            results.push({
              name: entry.name,
              path: relativePath,
              type: "file" as const,
              size: info.size,
            });
          } catch {
            results.push({
              name: entry.name,
              path: relativePath,
              type: "file" as const,
            });
          }
        }
      }

      return results;
    }

    const contents = await listDir(target, 0);

    const files = contents
      .filter((e) => e.type === "file")
      .sort((a, b) => a.name.localeCompare(b.name));
    const dirs = contents
      .filter((e) => e.type === "directory")
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      path: target,
      files,
      directories: dirs,
      totalFiles: files.length,
      totalDirectories: dirs.length,
    };
  },
});
