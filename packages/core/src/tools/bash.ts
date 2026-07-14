import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export const bashTool = createTool({
  id: "bash",
  description:
    "Execute a shell command in a subprocess. Returns stdout, stderr, and exit code.",
  requireApproval: true,
  inputSchema: z.object({
    command: z.string().describe("The shell command to execute"),
    cwd: z
      .string()
      .optional()
      .describe("Working directory for the command"),
    timeout: z
      .number()
      .int()
      .positive()
      .default(30000)
      .describe("Timeout in milliseconds (default 30000)"),
  }),
  execute: async ({ command, cwd, timeout }) => {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd || process.cwd(),
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        shell: "/bin/bash",
      });

      return {
        stdout: stdout.slice(0, 50000),
        stderr: stderr.slice(0, 50000),
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        stdout: error.stdout?.slice(0, 50000) || "",
        stderr: error.stderr?.slice(0, 50000) || error.message || "",
        exitCode: error.code || 1,
        killed: error.killed || false,
      };
    }
  },
});
